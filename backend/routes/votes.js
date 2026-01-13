const express = require('express');
const router = express.Router();
const db = require('../db'); 
const moment = require('moment'); 
const { v4: uuidv4 } = require('uuid'); 
const jwt = require('jsonwebtoken'); 
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');


router.get('/representative-overview', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        const groupId = req.cookies.group_id;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token missing' });
        }

        if (!groupId || isNaN(Number(groupId))) {
            return res.status(400).json({ success: false, message: 'Invalid or missing group ID' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        
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

        
        const isRepresentative = representative
            ? parseInt(representative.id, 10) === parseInt(userId, 10)
            : false;

        res.json({ success: true, users, representative, isRepresentative });
    } catch (err) {
        console.error('Error fetching representative overview:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch representative overview.' });
    }
});


router.post('/representative', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        const groupId = req.cookies.group_id;

        if (!token || !groupId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Token or Group ID missing' });
        }

        
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


router.get('/vote-actions', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const groupId = req.cookies.group_id; 
        if (!groupId) {
            return res.status(400).json({ message: 'Group ID is missing in cookies.' });
        }

        
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


router.post('/vote-actions', async (req, res) => {
    try {
        const token = req.cookies.access_token;
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;
        const groupId = req.cookies.group_id; 

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
            const voteId = require('uuid').v4(); 
            const formattedDeadline = deadline
            ? moment(deadline).format('YYYY-MM-DD HH:mm:ss')
            : moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss'); 

            
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


router.post('/vote-actions/:id', async (req, res) => {
    const { id } = req.params;
    const { type, groupId } = req.body;

    if (!id || !type || !groupId || !['yes', 'no'].includes(type)) {
        return res.status(400).json({ message: 'Invalid request.' });
    }

    try {
        
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


router.post('/:id/comments', async (req, res) => {
    try {
        
        const token = req.cookies.access_token;
        if (!token) {
            console.warn('トークンがCookieにありません');
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user_id;

        const { id } = req.params;
        const { comment } = req.body;

        if (!id || !comment) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        
        const newCommentId = uuidv4();
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

        await db.query(
            'INSERT INTO vote_comments (id, vote_id, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?)',
            [newCommentId, id, userId, comment, createdAt]
        );

        
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


router.post('/vote-actions/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { reason, targetUserId, userId, groupId } = req.body;

    if (!id || !reason || !targetUserId || !userId || !groupId) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        
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

        
        targetUserId = targetUserId || voteDetails[0].target_user_id;
        userId = userId || voteDetails[0].user_id;
        groupId = groupId || voteDetails[0].group_id;
        reason = reason || voteDetails[0].reason; 

        
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

        
        const [representativeResult] = await connection.query(
            'SELECT nickname FROM users WHERE id = ?',
            [userId]
        );
        const representativeName = representativeResult[0]?.nickname || '不明';

        const [targetUserResult] = targetUserId
            ? await connection.query('SELECT nickname FROM users WHERE id = ?', [targetUserId])
            : [];
        const targetUserName = targetUserResult[0]?.nickname || '不明';

        
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

        
        await connection.query(
            `INSERT INTO histories 
            (vote_action_id, action, reason, yes, no, resolved, deadline, target_user, representative, group_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                voteId,
                '追放', 
                reason,
                yesVotes,
                noVotes,
                true,
                new Date(), 
                targetUserName,
                representativeName,
                groupId,
            ]
        );

        
        await connection.query('DELETE FROM vote_records WHERE vote_action_id = ?', [voteId]);

        if (result === 'success') {

            
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
            await connection.query('DELETE FROM users WHERE id = ?', [targetUserId]); 
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
