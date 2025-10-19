const express = require('express');
const router = express.Router();
const db = require('../db'); // DB接続
const moment = require('moment'); // moment.jsをインポート
const { v4: uuidv4 } = require('uuid'); // UUID生成ライブラリをインポート
const jwt = require('jsonwebtoken'); // トークン検証用
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

// 代表者情報と投票状況を取得する統合エンドポイント
router.get('/representative-overview', async (req, res) => {
    try {
        // Cookieからトークンとgroup_idを取得
        const token = req.cookies.access_token;
        const groupId = req.cookies.group_id;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token missing' });
        }

        if (!groupId || isNaN(Number(groupId))) {
            return res.status(400).json({ success: false, message: 'Invalid or missing group ID' });
        }

        // トークンを検証
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        // グループ内の全ユーザーと投票数を取得
        const [users] = await db.query(`
            SELECT 
                u.id AS user_id,
                u.nickname,
                u.icon,
                u.group_id,
                COUNT(rv.candidate_id) AS total_votes
            FROM users u
            LEFT JOIN representative_votes rv ON u.id = rv.candidate_id
            WHERE u.group_id = ?
            GROUP BY u.id;
        `, [groupId]);

        // グループ内の代表者情報を取得
        const [representativeResults] = await db.query(`
            SELECT 
                rv.candidate_id AS representative_id,
                COUNT(rv.candidate_id) AS votes, 
                u.nickname,
                u.icon
            FROM representative_votes rv
            LEFT JOIN users u ON rv.candidate_id = u.id
            WHERE rv.group_id = ?
            GROUP BY rv.candidate_id, u.nickname, u.icon
            ORDER BY votes DESC;
        `, [groupId]);

        // 代表者を判定
        let representative = null;
        if (representativeResults.length > 0) {
            const topVoteCount = representativeResults[0].votes;
            const topCandidates = representativeResults.filter(r => r.votes === topVoteCount);

            if (topCandidates.length === 1) {
                representative = {
                    id: topCandidates[0].representative_id,
                    votes: topCandidates[0].votes,
                    nickname: topCandidates[0].nickname,
                    icon: topCandidates[0].icon,
                };
            }
        }

        // 現在のユーザーが代表者かどうかを判定
        const isRepresentative = representative
            ? parseInt(representative.id, 10) === parseInt(userId, 10)
            : false;

        res.json({ success: true, users, representative, isRepresentative });
    } catch (err) {
        console.error('Error fetching representative overview:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch representative overview.' });
    }
});

// 代表者投票
router.post('/representative', async (req, res) => {
    try {
        // Cookieからトークンとgroup_idを取得
        const token = req.cookies.access_token;
        const groupId = req.cookies.group_id;

        if (!token || !groupId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token or Group ID missing' });
        }

        // トークンを検証
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const voterId = decoded.user_id;

        const { candidateId } = req.body;
        if (!candidateId || isNaN(candidateId)) {
            return res.status(400).json({ message: 'Invalid candidateId' });
        }

        const [voterGroupCheck] = await db.query(`SELECT group_id FROM users WHERE id = ?`, [voterId]);
        const [candidateGroupCheck] = await db.query(`SELECT group_id FROM users WHERE id = ?`, [candidateId]);

        if (
            voterGroupCheck.length === 0 ||
            candidateGroupCheck.length === 0 ||
            voterGroupCheck[0].group_id !== candidateGroupCheck[0].group_id ||
            voterGroupCheck[0].group_id !== Number(groupId)
        ) {
            return res.status(400).json({ message: 'Voter and candidate must belong to the same group' });
        }

        await db.query(`
            INSERT INTO representative_votes (group_id, voter_id, candidate_id) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE candidate_id = VALUES(candidate_id)
        `, [groupId, voterId, candidateId]);

        const [voteCounts] = await db.query(`
            SELECT candidate_id, COUNT(*) as total_votes
            FROM representative_votes
            WHERE candidate_id = ?
            GROUP BY candidate_id
        `, [candidateId]);

        res.json({
            success: true,
            message: 'Vote registered successfully',
            totalVotes: voteCounts.length > 0 ? voteCounts[0].total_votes : 0,
        });
    } catch (error) {
        console.error('Error voting for representative:', error.message);
        res.status(500).json({ message: 'Error voting for representative.' });
    }
});

// 特別投票用エンドポイント
router.get('/vote-actions', async (req, res) => {
    try {
        // Cookieからトークンを取得
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const groupId = req.cookies.group_id; // Cookieからgroup_idを取得
        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is missing in cookies.' });
        }

        // データの取得
        const [votes] = await db.query(`
            SELECT 
                id, type, action, reason, resolved, deadline, user_id, target_user_id, group_id
            FROM vote_actions
            WHERE group_id = ?;
        `, [groupId]);

        const processedVotes = await Promise.all(votes.map(async (vote) => {
            const [results] = await db.query(`
                SELECT vote_type, COUNT(*) as count 
                FROM vote_records
                WHERE vote_action_id = ?
                GROUP BY vote_type;
            `, [vote.id]);

            const yesVotes = results.find(r => r.vote_type === 'yes')?.count || 0;
            const noVotes = results.find(r => r.vote_type === 'no')?.count || 0;

            return { ...vote, yes: yesVotes, no: noVotes };
        }));

        res.json(processedVotes);
    } catch (err) {
        console.error('Error fetching votes:', err.message);
        res.status(500).json({ message: 'Error fetching votes.' });
    }
});

// 投票を作成
router.post('/vote-actions', async (req, res) => {
    try {
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;
        const groupId = req.cookies.group_id; // Cookieからgroup_idを取得

        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is missing in cookies.' });
        }

        const { type, action, reason, deadline, targetUserId } = req.body;
        if (!type || !action || !reason || (action === '追放' && !targetUserId)) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const voteId = require('uuid').v4(); // UUIDを生成
            const formattedDeadline = deadline
            ? moment(deadline).format('YYYY-MM-DD HH:mm:ss')
            : moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss'); // 期限を3日後に設定

            // 投票をデータベースに登録
            await connection.query(
                `INSERT INTO vote_actions 
                (id, type, action, reason, deadline, resolved, user_id, group_id, target_user_id) 
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
                [voteId, type, action, reason, formattedDeadline, userId, groupId, targetUserId]
            );

            schedule.scheduleJob(new Date(formattedDeadline), async () => {
                await processVoteById(voteId);
            });

            await connection.commit();
            res.json({ message: 'Vote created successfully and scheduled for auto-resolution.' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error creating vote:', err.message);
        res.status(500).json({ message: 'Error creating vote.' });
    }
});

// 投票の賛成・反対を更新
router.post('/vote-actions/:id', async (req, res) => {
    const { id } = req.params;
    const { type, groupId } = req.body;

    if (!id || !type || !groupId || !['yes', 'no'].includes(type)) {
        return res.status(400).json({ message: 'Invalid request.' });
    }

    try {
        // トークンの検証
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const [existingVote] = await connection.query(
                'SELECT vote_type FROM vote_records WHERE vote_action_id = ? AND user_id = ?',
                [id, userId]
            );

            if (existingVote.length > 0) {
                await connection.query(
                    'DELETE FROM vote_records WHERE vote_action_id = ? AND user_id = ?',
                    [id, userId]
                );
            }

            await connection.query(
                'INSERT INTO vote_records (vote_action_id, user_id, group_id, vote_type) VALUES (?, ?, ?, ?)',
                [id, userId, groupId, type]
            );

            await connection.commit();
            res.json({ message: 'Vote updated successfully.' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error updating vote:', err.message);
        res.status(500).json({ message: 'Error updating vote.' });
    }
});

// コメント一覧の取得
router.get('/:id/comments', async (req, res) => {
    const { id } = req.params;
    try {
        const [comments] = await db.query(
            'SELECT vc.id, vc.vote_id, vc.user_id, vc.comment, vc.created_at, u.nickname FROM vote_comments vc JOIN users u ON vc.user_id = u.id WHERE vc.vote_id = ? ORDER BY vc.created_at DESC',
            [id]
        );
        res.status(200).json(comments);
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).json({ error: 'Failed to fetch comments.' });
    }
});

// コメントの追加
router.post('/:id/comments', async (req, res) => {
    try {
        // Cookieからトークンを取得
        const token = req.cookies.access_token;
        if (!token) {
            console.warn('トークンがCookieにありません');
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // トークンを検証
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        const { id } = req.params;
        const { comment } = req.body;

        if (!id || !comment) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // コメントを追加
        const newCommentId = uuidv4();
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

        await db.query(
            'INSERT INTO vote_comments (id, vote_id, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?)',
            [newCommentId, id, userId, comment, createdAt]
        );

        // ユーザーのニックネームを取得
        const [userResult] = await db.query('SELECT nickname FROM users WHERE id = ?', [userId]);
        const userNickname = userResult[0]?.nickname || 'Unknown';

        res.status(201).json({
            success: true,
            commentId: newCommentId,
            created_at: createdAt,
            userNickname,
        });
    } catch (err) {
        console.error('コメント追加エラー:', err.message);
        res.status(500).json({ success: false, message: 'Database error occurred.' });
    }
});

// 投票アクションを完了
router.post('/vote-actions/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { reason, targetUserId, userId, groupId } = req.body;

    if (!id || !reason || !targetUserId || !userId || !groupId) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        // 期限切れまたは通常の解決を処理
        await processVoteById(id, reason, userId, targetUserId, groupId);

        res.json({ message: 'Vote resolved successfully.' });
    } catch (error) {
        console.error('Error resolving vote:', error);
        res.status(500).json({ message: 'Error resolving vote.' });
    }
});

const processVoteById = async (voteId, reason = null, userId = null, targetUserId = null, groupId = null) => {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // 投票の詳細を取得
        const [voteDetails] = await connection.query(
            `SELECT target_user_id, user_id, group_id, resolved, reason 
             FROM vote_actions 
             WHERE id = ?`,
            [voteId]
        );

        if (voteDetails.length === 0 || voteDetails[0].resolved) {
            console.log(`Vote ID ${voteId} is already resolved or does not exist.`);
            return;
        }

        // 必要なデータを取得
        targetUserId = targetUserId || voteDetails[0].target_user_id;
        userId = userId || voteDetails[0].user_id;
        groupId = groupId || voteDetails[0].group_id;
        reason = reason || voteDetails[0].reason; // 投票詳細から理由を取得

        // 賛成と反対の投票数を取得
        const [voteCounts] = await connection.query(
            `SELECT 
                SUM(vote_type = 'yes') AS yesVotes, 
                SUM(vote_type = 'no') AS noVotes 
             FROM vote_records 
             WHERE vote_action_id = ?`,
            [voteId]
        );

        const yesVotes = voteCounts[0]?.yesVotes || 0;
        const noVotes = voteCounts[0]?.noVotes || 0;

        const result = yesVotes > noVotes ? 'success' : 'failure';

        // userIdからニックネームを取得
        const [representativeResult] = await connection.query(
            'SELECT nickname FROM users WHERE id = ?',
            [userId]
        );
        const representativeName = representativeResult[0]?.nickname || '不明';

        const [targetUserResult] = targetUserId
            ? await connection.query('SELECT nickname FROM users WHERE id = ?', [targetUserId])
            : [];
        const targetUserName = targetUserResult[0]?.nickname || '不明';

        // 投票を resolved 状態にし、名前を保存
        await connection.query(
            `UPDATE vote_actions 
            SET resolved = true, reason = ?, representative_name = ?, target_user_name = ? 
            WHERE id = ?`,
            [
                reason,
                representativeName,
                targetUserName,
                voteId,
            ]
        );

        // 履歴に記録
        await connection.query(
            `INSERT INTO histories 
            (vote_action_id, action, reason, yes, no, resolved, deadline, target_user, representative, group_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                voteId,
                '追放', // 固定値
                reason,
                yesVotes,
                noVotes,
                true,
                new Date(), // 現在時刻を登録
                targetUserName,
                representativeName,
                groupId,
            ]
        );

        // 投票記録を削除
        await connection.query('DELETE FROM vote_records WHERE vote_action_id = ?', [voteId]);

        if (result === 'success') {

            // 可決の場合、関連データを削除
            if (targetUserId) {
                const [userResult] = await connection.query('SELECT icon FROM users WHERE id = ?', [targetUserId]);
                const userIconPath = userResult[0]?.icon;

                if (userIconPath && userIconPath.startsWith('/uploads/')) {
                    const absolutePath = path.join(__dirname, '..', userIconPath);
                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                        console.log(`アイコン削除: ${absolutePath}`);
                    }
                }
            }

            await connection.query('DELETE FROM comments WHERE user_id = ?', [targetUserId]);
            await connection.query('DELETE FROM posts WHERE user_id = ?', [targetUserId]);
            await connection.query('DELETE FROM vote_records WHERE vote_action_id = ?', [voteId]);
            await connection.query('DELETE FROM vote_actions WHERE target_user_id = ?', [targetUserId]);
            await connection.query('DELETE FROM representative_votes WHERE candidate_id = ?', [targetUserId]);
            await connection.query('DELETE FROM users WHERE id = ?', [targetUserId]); // 最後にユーザー削除
        }

        await connection.commit();
        console.log(`Vote ID ${voteId} processed successfully and recorded in histories.`);
    } catch (error) {
        await connection.rollback();
        console.error(`Error processing vote ID ${voteId}:`, error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = router;
