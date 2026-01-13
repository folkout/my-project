const express = require('express');
const router = express.Router();
const db = require('../db'); 
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');


router.post('/', async (req, res) => {
    const groupId = req.cookies.group_id; 

    if (!groupId) {
        return res.status(400).json({ success: false, error: 'Group ID is required' });
    }

    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Tag name is required' });
    }

    try {
        
        const [tagCount] = await db.execute('SELECT COUNT(*) as count FROM tags WHERE group_id = ?', [groupId]);
        if (tagCount[0].count >= 10) {
            return res.status(400).json({ success: false, error: 'Tag limit reached. Maximum 10 tags allowed per group.' });
        }

        
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


router.get('/', async (req, res) => {
    try {
        
        const groupId = req.cookies.group_id;
        if (!groupId) {
            return res.status(400).json({ success: false, message: 'Group ID is required' });
        }

        
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


router.delete('/:tagId', async (req, res) => {
    const { tagId } = req.params;
    const groupId = req.cookies.group_id; 

    if (!groupId) {
        return res.status(400).json({ success: false, message: 'Group ID is required' });
    }

    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        
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

        
        const [tag] = await db.query('SELECT name FROM tags WHERE id = ? AND group_id = ?', [tagId, groupId]);
        if (tag.length === 0) {
            return res.status(404).json({ success: false, error: 'Tag not found' });
        }

        
        await db.query('UPDATE posts SET tag = NULL WHERE tag = ?', [tag[0].name]);

        
        await db.query('DELETE FROM tags WHERE id = ?', [tagId]);

        res.status(200).json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ success: false, error: 'Failed to delete tag' });
    }
});


router.get('/check-representative', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        
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
