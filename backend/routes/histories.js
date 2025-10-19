const express = require('express');
const router = express.Router();
const db = require('../db'); // データベース接続モジュール

router.get('/vote-actions', async (req, res) => {
    try {
        // Cookieからgroup_idを取得
        const groupId = req.cookies.group_id;
        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is missing in cookies.' });
        }

        // histories テーブルから必要な情報を取得
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

        // 各履歴について追加計算なしに直接レスポンスを返す
        const formattedHistories = histories.map(history => {
            return {
                deadline: history.deadline,
                action: history.action,
                yes: parseInt(history.yes, 10) || 0, // 明示的に数値として扱う
                no: parseInt(history.no, 10) || 0,  // 明示的に数値として扱う
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