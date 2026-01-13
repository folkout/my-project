const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid'); 
require('dotenv').config(); 
const jwt = require('jsonwebtoken'); 


const isUUID = (id) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);


router.get('/', async (req, res) => {
    const groupId = req.cookies.group_id; 

    if (!groupId) {
        return res.status(400).json({ success: false, error: 'Group ID is required' });
    }

    try {
        const [rows] = await db.query(`
            SELECT 
                p.id AS post_id,
                p.content AS post_content,
                p.created_at AS post_created_at,
                p.tag AS post_tag, -- タグ情報を追加
                COALESCE(u.nickname, CONCAT('user', u.id)) AS post_nickname,
                u.icon AS post_icon,
                c.id AS comment_id,
                c.content AS comment_content,
                c.created_at AS comment_created_at,
                COALESCE(cu.nickname, CONCAT('user', cu.id)) AS comment_nickname,
                cu.icon AS comment_icon
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN comments c ON p.id = c.post_id
            LEFT JOIN users cu ON c.user_id = cu.id
            WHERE p.group_id = ? -- クッキーから取得した group_id でフィルタリング
            ORDER BY p.created_at DESC, c.created_at ASC
        `, [groupId]);

        const posts = rows.reduce((acc, row) => {
            let post = acc.find(p => p.id === row.post_id);
            if (!post) {
                post = {
                    id: row.post_id,
                    content: row.post_content,
                    tag: row.post_tag, 
                    created_at: row.post_created_at,
                    nickname: row.post_nickname,
                    icon: row.post_icon,
                    comments: [],
                };
                acc.push(post);
            }

            if (row.comment_id) {
                post.comments.push({
                    id: row.comment_id,
                    content: row.comment_content,
                    created_at: row.comment_created_at,
                    nickname: row.comment_nickname,
                    icon: row.comment_icon,
                });
            }

            return acc;
        }, []);

        res.status(200).json({ success: true, posts });
    } catch (error) {
        console.error('Error fetching posts and comments:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch posts and comments' });
    }
});


router.post('/', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            console.warn('トークンがCookieにありません');
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        
        const groupId = req.cookies.group_id;
        if (!groupId) {
            console.warn('group_idがCookieにありません');
            return res.status(400).json({ success: false, message: 'Group ID is required' });
        }

        
        const { content } = req.body;
        if (!content) {
            console.warn('投稿内容が不完全');
            return res.status(400).json({ success: false, message: 'Content is required' });
        }

        
        const newPostId = uuidv4();
        await db.query(
            'INSERT INTO posts (id, user_id, group_id, content) VALUES (?, ?, ?, ?)',
            [newPostId, userId, groupId, content]
        );

        res.status(201).json({
            success: true,
            postId: newPostId,
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('投稿エラー:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to add post' });
    }
});


router.post('/:postId/comments', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token missing' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        
        const { content } = req.body;
        const { postId } = req.params;

        
        if (!content || !postId) {
            console.warn('コメント内容またはpostIdが無効です');
            return res.status(400).json({ success: false, message: 'Content and postId are required' });
        }

        
        const [postRows] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
        if (postRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        
        const commentId = uuidv4();
        await db.query(
            'INSERT INTO comments (id, post_id, content, user_id) VALUES (?, ?, ?, ?)',
            [commentId, postId, content.trim(), userId]
        );

        res.status(201).json({
            success: true,
            comment: {
                id: commentId,
                content,
                nickname: decoded.nickname,
                icon: decoded.icon,
                created_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('コメント追加エラー:', error.message);
        res.status(500).json({ success: false, message: 'Failed to add comment' });
    }
});


router.get('/is_in_library', async (req, res) => {
    try {
        
        const groupId = req.cookies.group_id;
        if (!groupId) {
            return res.status(400).json({ success: false, message: 'Group ID is required' });
        }

        
        const [libraryPosts] = await db.execute(`
            SELECT 
                p.*, 
                COALESCE(u.nickname, CONCAT('user', u.id)) AS post_nickname,
                u.icon AS post_icon,
                COALESCE(leu.nickname, CONCAT('user', p.last_editor_id)) AS last_editor_nickname,
                leu.icon AS last_editor_icon
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN users leu ON p.last_editor_id = leu.id
            WHERE p.is_in_library = 1 AND p.group_id = ? -- グループIDでフィルタリング
            ORDER BY p.created_at DESC
        `, [groupId]);

        for (let post of libraryPosts) {
            const [comments] = await db.execute(`
                SELECT 
                    c.id, 
                    c.content, 
                    c.created_at, 
                    COALESCE(u.nickname, CONCAT('user', c.user_id)) AS nickname
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.post_id = ?
                ORDER BY c.created_at ASC
            `, [post.id]);

            post.comments = comments;
        }

        res.status(200).json({ success: true, library: libraryPosts || [] });
    } catch (error) {
        console.error('Error fetching library posts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch library posts' });
    }
});


router.post('/:postId/add-to-library', async (req, res) => {
    try {
        
        const token = req.cookies.access_token; 
        console.log('Token received:', token); 

        if (!token) {
            console.warn('No token provided'); 
            return res.status(401).json({ success: false, message: 'Unauthorized: Token missing' });
        }

        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token verified successfully:', decoded); 
        } catch (err) {
            console.error('Token verification failed:', err.message); 
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        const userId = decoded.user_id;
        console.log('User ID extracted from token:', userId); 

        
        const { postId } = req.params;

        
        const [postRows] = await db.query('SELECT id FROM posts WHERE id = ?', [postId]);
        if (postRows.length === 0) {
            console.error('Post not found:', postId);
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        
        const [updateResult] = await db.query(
            'UPDATE posts SET is_in_library = 1, added_to_library_at = NOW(), last_editor_id = ? WHERE id = ?',
            [userId, postId]
        );

        if (updateResult.affectedRows === 0) {
            console.error('Failed to add post to library:', postId);
            return res.status(500).json({ success: false, message: 'Failed to add post to library' });
        }

        res.status(200).json({ success: true, message: 'Post added to library successfully' });
    } catch (error) {
        console.error('Error adding post to library:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.put('/:postId/tag', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token missing' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        const { postId } = req.params;
        const { tag_name } = req.body; 

        if (!tag_name || tag_name.trim() === '') {
            console.error('タグ名が不足しています');
            return res.status(400).json({ success: false, error: 'Tag name is required' });
        }

        
        const [result] = await db.execute(
            'UPDATE posts SET tag = ?, last_editor_id = ? WHERE id = ?',
            [tag_name.trim(), userId, postId]
        );

        if (result.affectedRows > 0) {
            res.status(200).json({ success: true, message: 'Tag updated successfully', tag: tag_name });
        } else {
            res.status(404).json({ success: false, error: 'Post not found' });
        }
    } catch (error) {
        console.error('タグ更新エラー:', error.message);
        res.status(500).json({ success: false, error: 'Failed to update tag' });
    }
});

module.exports = router;
