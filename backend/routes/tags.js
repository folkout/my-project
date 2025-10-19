const express = require('express');
const router = express.Router();
const db = require('../db'); // データベース接続
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// タグを作成
router.post('/', async (req, res) => {
    const groupId = req.cookies.group_id; // クッキーから group_id を取得

    if (!groupId) {
        return res.status(400).json({ success: false, error: 'Group ID is required' });
    }

    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Tag name is required' });
    }

    try {
        // 現在のタグ数を確認
        const [tagCount] = await db.execute('SELECT COUNT(*) as count FROM tags WHERE group_id = ?', [groupId]);
        if (tagCount[0].count >= 10) {
            return res.status(400).json({ success: false, error: 'Tag limit reached. Maximum 10 tags allowed per group.' });
        }

        // タグを作成
        const [result] = await db.execute('INSERT INTO tags (name, group_id) VALUES (?, ?)', [name.trim(), groupId]);
        res.status(201).json({ success: true, tag: { id: result.insertId, name: name.trim() } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, error: 'Tag already exists' });
        } else {
            console.error('Error creating tag:', error);
            res.status(500).json({ success: false, error: 'Failed to create tag' });
        }
    }
});

// タグ一覧を取得
router.get('/', async (req, res) => {
    try {
        // クッキーから group_id を取得
        const groupId = req.cookies.group_id;
        if (!groupId) {
            return res.status(400).json({ success: false, message: 'Group ID is required' });
        }

        // グループIDごとのタグを取得
        const [tags] = await db.execute(
            'SELECT * FROM tags WHERE group_id = ? ORDER BY created_at DESC',
            [groupId]
        );

        res.status(200).json({ success: true, tags });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
});

// タグを削除するエンドポイント
router.delete('/:tagId', async (req, res) => {
    const { tagId } = req.params;
    const groupId = req.cookies.group_id; // クッキーから group_id を取得

    if (!groupId) {
        return res.status(400).json({ success: false, message: 'Group ID is required' });
    }

    try {
        // Cookieからトークンを取得
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // トークンを検証
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        // **修正: グループ内で最も多く票を得た candidate_id を取得**
        const [representative] = await db.query(
            `SELECT candidate_id 
             FROM representative_votes 
             WHERE group_id = ?
             GROUP BY candidate_id 
             ORDER BY COUNT(*) DESC 
             LIMIT 1;`,
            [groupId]
        );

        if (representative.length === 0 || representative[0].candidate_id !== userId) {
            return res.status(403).json({ success: false, message: '代表者のみタグ削除可' });
        }

        // タグの存在確認
        const [tag] = await db.query('SELECT name FROM tags WHERE id = ? AND group_id = ?', [tagId, groupId]);
        if (tag.length === 0) {
            return res.status(404).json({ success: false, error: 'Tag not found' });
        }

        // 投稿に関連するタグをクリア
        await db.query('UPDATE posts SET tag = NULL WHERE tag = ?', [tag[0].name]);

        // タグ削除
        await db.query('DELETE FROM tags WHERE id = ?', [tagId]);

        res.status(200).json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ success: false, error: 'Failed to delete tag' });
    }
});

// 代表者チェックエンドポイント
router.get('/check-representative', async (req, res) => {
    try {
        // Cookieからトークンを取得
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // トークンを検証
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 代表者判定
        const [representative] = await db.query(
            'SELECT candidate_id FROM representative_votes WHERE candidate_id = ? AND group_id = ?',
            [decoded.user_id, decoded.group_id]
        );

        const isRepresentative = representative.length > 0;

        res.status(200).json({ isRepresentative });
    } catch (error) {
        console.error('代表者チェックエラー:', error);
        res.status(500).json({ error: 'Failed to check representative status' });
    }
});

module.exports = router;
