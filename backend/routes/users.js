const express = require('express');
const router = express.Router();
const db = require('../db'); 
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken'); 
const path = require('path');


router.use(express.json());
router.use(express.urlencoded({ extended: true }));


const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); 
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); 
        cb(null, `${Date.now()}${ext}`); 
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
});

router.post('/me', async (req, res) => {
    try {
        const token = req.cookies.access_token;
        if (!token) {
            console.warn('No token provided');
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err.message);
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        const userId = decoded.user_id;

        const [rows] = await db.query('SELECT id, nickname, icon, group_id FROM users WHERE id = ?', [userId]);

        if (rows.length === 0) {
            console.warn('User not found for ID:', userId);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        
        res.status(200).json({ success: true, user: rows[0] });

    } catch (error) {
        console.error('Error in /me endpoint:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch user data' });
    }
});

router.put('/settings', upload.single('icon'), async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err.message);
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        const userId = decoded.user_id;
        const nickname = req.body.nickname?.trim();
        const ext = req.file ? path.extname(req.file.originalname) : null; 
        const newIconPath = ext ? path.join(uploadsDir, `${userId}${ext}`) : null;

        
        const [[existingUser]] = await db.execute('SELECT nickname, icon FROM users WHERE id = ?', [userId]);
        if (!existingUser) {
            console.error('User not found:', userId);
            return res.status(404).json({ success: false, error: 'ユーザーが見つかりません。' });
        }

        
        if (newIconPath && existingUser.icon && existingUser.icon.startsWith('/uploads/')) {
            const oldIconPath = path.join(__dirname, '..', existingUser.icon);
            if (fs.existsSync(oldIconPath)) {
                fs.unlinkSync(oldIconPath);
            }
        }

        
        if (newIconPath) {
            fs.renameSync(req.file.path, newIconPath);
        }

        const finalNickname = nickname || existingUser.nickname || `user${userId}`;
        const finalIconUrl = newIconPath ? `/uploads/${userId}${ext}` : existingUser.icon;

        
        const queryParts = [];
        const params = [];

        if (nickname) {
            queryParts.push('nickname = ?');
            params.push(finalNickname);
        }

        if (newIconPath) {
            queryParts.push('icon = ?');
            params.push(finalIconUrl);
        }

        if (queryParts.length === 0) {
            return res.status(400).json({ success: false, error: '更新データがありません。' });
        }

        const query = `UPDATE users SET ${queryParts.join(', ')} WHERE id = ?`;
        params.push(userId);

        const [result] = await db.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'ユーザー情報の更新に失敗しました。' });
        }

        res.status(200).json({
            success: true,
            message: 'アカウント設定を更新しました。',
            user: { nickname: finalNickname, icon: finalIconUrl },
        });
    } catch (error) {
        console.error('Error updating account settings:', error.message);
        res.status(500).json({ success: false, error: 'アカウント設定の更新に失敗しました。' });
    }
});


router.put('/:userId/icon', async (req, res) => {
    const { userId } = req.params;
    const { iconUrl } = req.body;

    if (!iconUrl || typeof iconUrl !== 'string') {
        return res.status(400).json({ success: false, error: '有効なアイコンURLを指定してください。' });
    }

    try {
        const [result] = await db.query('UPDATE users SET icon = ? WHERE id = ?', [iconUrl, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'ユーザーが見つかりません。' });
        }

        res.status(200).json({ success: true, message: 'アイコンを更新しました。', icon: iconUrl });
    } catch (error) {
        console.error('Error updating icon:', error.message);
        res.status(500).json({ success: false, error: 'アイコンの更新に失敗しました。' });
    }
});


router.delete('/delete', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: No token provided' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err.message);
            return res.status(403).json({ message: 'Invalid token' });
        }

        const userId = decoded.user_id;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            
            const [userResult] = await connection.query('SELECT icon FROM users WHERE id = ?', [userId]); 
            const userIconPath = userResult[0]?.icon;

            if (userIconPath && userIconPath.startsWith('/uploads/')) {
                const absolutePath = path.join(__dirname, '..', userIconPath);
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                    console.log(`アイコン削除: ${absolutePath}`);
                }
            }

            await connection.query('DELETE FROM comments WHERE user_id = ?', [userId]);
            await connection.query('DELETE FROM posts WHERE user_id = ?', [userId]);
            await connection.query('DELETE FROM vote_actions WHERE target_user_id = ?', [userId]);
            await connection.query('DELETE FROM representative_votes WHERE candidate_id = ?', [userId]);
            await connection.query('DELETE FROM users WHERE id = ?', [userId]);

            await connection.commit(); 
            res.json({ message: 'Account deleted successfully.' });
        } catch (error) {
            await connection.rollback(); 
            console.error('Error deleting user account:', error);
            res.status(500).json({ message: 'Error deleting account.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in account deletion process:', error.message);
        res.status(500).json({ message: 'Server error during account deletion.' });
    }
});

router.post('/check-status', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
        }

        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err.message);
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        const userId = decoded.user_id;

        
        const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);

        if (rows.length === 0) {
            console.warn('User not found for ID:', userId);
            return res.json({ isDeleted: true });
        }

        res.json({ isDeleted: false });
    } catch (error) {
        console.error('Error in /check-status endpoint:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;