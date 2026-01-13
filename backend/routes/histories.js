const express = require('express');
const router = express.Router();
const db = require('../db'); 

router.get('/vote-actions', async (req, res) => {
    try {
        
        const groupId = req.cookies.group_id;
        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is missing in cookies.' });
        }

        
        const [histories] = await db.query(`
            SELECT 
                id AS vote_action_id,
                action,
                reason,
                resolved,
                deadline,
                target_user,
                representative,
                group_id,
                yes,
                no
            FROM histories
            WHERE group_id = CAST(? AS UNSIGNED)
            ORDER BY created_at DESC;
        `, [groupId]);

        
        const formattedHistories = histories.map(history => {
            return {
                deadline: history.deadline,
                action: history.action,
                yes: parseInt(history.yes, 10) || 0, 
                no: parseInt(history.no, 10) || 0,  
                representative: history.representative || '不明',
                target_user: history.target_user || '不明',
                reason: history.reason || '理由なし',
            };
        });

        res.json(formattedHistories);
    } catch (err) {
        console.error('Error fetching vote actions from histories:', err);
        res.status(500).json({ message: 'Error fetching vote actions from histories.' });
    }
});

module.exports = router;