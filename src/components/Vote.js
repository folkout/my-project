import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Vote.css'; // CSSファイルをインポート

const Vote = () => {
    const [users, setUsers] = useState([]);
    const [groupId, setGroupId] = useState(1); // groupIdを動的に管理
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentRepresentative, setCurrentRepresentative] = useState(null);
    const [isVoteActive, setIsVoteActive] = useState(false);
    const [votes, setVotes] = useState([]); // 全投票データ
    const [activeVote, setActiveVote] = useState(null); // 現在アクティブな投票
    const [voteType, setVoteType] = useState('追放'); // Selected vote type
    const [voteReason, setVoteReason] = useState('');
    const [selectedUser, setSelectedUser] = useState(''); // User selected for expulsion
    const [error, setError] = useState(null); // エラーステートの定義
    const [comments, setComments] = useState([]); // コメントリスト
    const [newComment, setNewComment] = useState(''); // 新しいコメント用ステート
    const [isLoading, setIsLoading] = useState(false); // ローディング状態を管理
    const [isRepresentative, setIsRepresentative] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL;

    const axiosInstance = axios.create({
        baseURL: `${API_URL}`, // APIのベースURL
        withCredentials: true, // トークンを含むクッキーを送信
    });
    
    useEffect(() => {
        const fetchRepresentativeOverview = async () => {
            try {
                setIsLoading(true);
    
                // 代表者情報と投票状況を取得
                const response = await axiosInstance.get('/api/votes/representative-overview', {
                    withCredentials: true, // クッキーを送信
                });
    
                const { users, representative, isRepresentative } = response.data;
    
                // データを状態に反映
                setUsers(users);
                setCurrentRepresentative(representative);
                setIsRepresentative(isRepresentative);
                setError(null);
            } catch (error) {
                console.error('Error fetching representative overview:', error);
                setError('データの取得に失敗しました。再試行してください。');
            } finally {
                setIsLoading(false);
            }
        };
    
        fetchRepresentativeOverview();
    }, []);
    
    const handleRepresentativeVote = (candidateId) => {
        axiosInstance
            .post('/api/votes/representative', {
                candidateId, // groupIdは送信しない
            })
            .then(() => {
                axiosInstance
                    .get('/api/votes/representative-overview')
                    .then((response) => {
                        const { users, representative, isRepresentative } = response.data;
                        setUsers(users);
                        setCurrentRepresentative(representative);
                        setIsRepresentative(isRepresentative);
                    })
                    .catch((error) => {
                        console.error('Error fetching updated data:', error);
                        setError('データの再取得に失敗しました。');
                    });
            })
            .catch((error) => {
                console.error('Error voting for representative:', error);
                setError('代表者投票に失敗しました。');
            });
    };
    
    useEffect(() => {
        axiosInstance
            .get('/api/votes/vote-actions')
            .then((response) => {
                const activeVote = response.data.find((vote) => !vote.resolved);
                if (activeVote) {
                    setActiveVote(activeVote);
                } else {
                    setActiveVote(null);
                }
            })
            .catch((error) => {
                console.error('Error fetching active vote:', error);
            });
    }, []);
    
    const handleCreateVote = async () => {
        try {
            const isRep = await checkRepresentativeStatus();
            if (!isRep) {
                alert("代表者のみが操作できます");
                return;
            }
    
            if (!voteReason.trim()) {
                alert("理由を入力してください。");
                return;
            }
    
            if (voteType === "追放" && !selectedUser) {
                alert("追放するユーザーを選択してください。");
                return;
            }
    
            const payload = {
                type: "投票",
                action: voteType,
                reason: voteReason,
                targetUserId: selectedUser || null,
            };
    
            await axiosInstance.post('/api/votes/vote-actions', payload);
    
            const response = await axiosInstance.get('/api/votes/vote-actions');
            const activeVote = response.data.find((vote) => !vote.resolved);
            if (activeVote) {
                setActiveVote(activeVote);
            } else {
                setActiveVote(null);
            }
    
            setVotes(response.data);
        } catch (error) {
            console.error('Error creating vote:', error);
        }
    };
    
    const checkRepresentativeStatus = async () => {
        try {
            const response = await axiosInstance.get('/api/votes/representative-overview');
            return response.data.isRepresentative;
        } catch (error) {
            console.error('Error checking representative status:', error);
            return false;
        }
    };
    
    const handleVote = async (voteId, type) => {
        try {
            await axiosInstance.post(`/api/votes/vote-actions/${voteId}`, {
                type,
                groupId,
            });
    
            const response = await axiosInstance.get('/api/votes/vote-actions', {
                params: { groupId },
            });
    
            setVotes(response.data);
    
            const active = response.data.find((vote) => !vote.resolved);
            setActiveVote(active || null);
        } catch (error) {
            console.error('Error processing vote:', error);
            setError('投票処理に失敗しました。サーバーまたはエンドポイントを確認してください。');
        }
    };
    
    useEffect(() => {
        if (activeVote) {
            axiosInstance
                .get(`/api/votes/${activeVote.id}/comments`, { withCredentials: true })
                .then((response) => {
                    setComments(response.data);
                })
                .catch((error) => {
                    console.error('Error fetching comments:', error);
                });        
        }
    }, [activeVote]);

  // 投票画面
  return (
    <div className="vote-container">
      {isLoading && <div className="loading-message">データを取得中...</div>}
      {error && <div className="error-message">{error}</div>}

      {/* 現在の代表者 */}
      <div className="representative-voting">
        <h2 className="section-title">代表者投票</h2>
        {currentRepresentative && currentRepresentative.nickname ? (
        <p className="current-representative">
            代表者: {currentRepresentative.nickname}
        </p>
        ) : (
        <p>代表者がまだ選ばれていません</p>
        )}

            <ul className="user-list">
            {users.length > 0 ? (
                users.map((user) => (
                    <li key={user.id} className="user-item"> 
                    <span className="user-name">
                        {user.nickname} 
                    </span>
                    <span className="user-votes">{user.total_votes || 0}</span>
                    <button
                        onClick={() => handleRepresentativeVote(user.user_id)} 
                        className="vote-button"
                    >
                        ◯
                    </button>
                    </li>
                ))
                ) : (
                <p>ユーザーが見つかりません</p>
            )}
            </ul>
      </div>

      {/* 投票部分 */}
      <div className="vote-section">
        <h2 className="section-title">投票</h2>
        {activeVote ? (
          <div className="active-vote">
            <h3>現在の投票</h3>
            <p>投票内容: {activeVote.action}</p>
            <p>
            対象者: {activeVote.target_user_id 
                ? users.find((user) => user.user_id === activeVote.target_user_id)?.nickname || '対象者が不明です'
                : '対象者が不明です'}
            </p>
            <p>
              理由: {activeVote.reason || '理由がありません'}
            </p>
            <p>締切: {new Date(activeVote.deadline).toLocaleString()}</p>
            <p>賛成 {activeVote.yes} / 反対 {activeVote.no}</p>

              <div className="vote-actions">
                  <button
                      onClick={() => handleVote(activeVote.id, 'yes')}
                      className="vote-btn-yes"
                  >
                      賛成
                  </button>
                  <button
                      onClick={() => handleVote(activeVote.id, 'no')}
                      className="vote-btn-no"
                  >
                      反対
                  </button>
              </div>

                {/* コメント部分を追加 */}
                <div className="comments-section">
                    <h3>コメント</h3>
                    {comments.length > 0 ? (
                        comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                                <strong>{comment.nickname}</strong>: {comment.comment}{' '}
                                <em>({new Date(comment.created_at).toLocaleString()})</em>
                            </div>
                        ))
                    ) : (
                        <p>コメントはまだありません。</p>
                    )}

                    {/* コメント入力フォーム */}
                    {activeVote && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!newComment.trim()) {
                                    alert('コメントを入力してください。');
                                    return;
                                }

                                // コメントを送信
                                axios
                                    .post(
                                        `${API_URL}/api/votes/${activeVote.id}/comments`,
                                        { comment: newComment }, // userIdは送信しない
                                        { withCredentials: true } // Cookieを送信
                                    )
                                    .then(() => {
                                        // コメントをリセット
                                        setNewComment('');
                                        // コメントを再取得
                                        axios
                                            .get(
                                                `${API_URL}/api/votes/${activeVote.id}/comments`,
                                                { withCredentials: true } // Cookieを送信
                                            )
                                            .then((response) => {
                                                setComments(response.data);
                                            })
                                            .catch((error) => {
                                                console.error('Error fetching comments:', error);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error('Error posting comment:', error);
                                    });
                            }}
                        >
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="コメントを入力してください"
                            />
                            <button type="submit">コメントを追加</button>
                        </form>
                    )}
                </div>
          </div>

        ) : (
            // アクティブな投票がない場合、新しい投票を作成
            <div className="vote-create">
                <select
                    value={voteType}
                    onChange={(e) => setVoteType(e.target.value)}
                    className="vote-select"
                >
                    <option value="追放">追放</option>
                </select>

                {voteType === '追放' && (
                    <select
                            value={selectedUser}
                            onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setSelectedUser(value); // 状態を更新
                            }}
                            className="user-select"
                        >
                            <option value="">--ユーザーを選択--</option>
                            {users.map((user) => {
                                return (
                        <option key={user.user_id} value={user.user_id}>
                            {user.nickname}
                        </option>
                            );
                        })}
                    </select>
                )}
                <input
                    type="text"
                    value={voteReason}
                    onChange={(e) => setVoteReason(e.target.value)}
                    placeholder="理由を入力"
                    className="vote-input"
                />
                <button onClick={handleCreateVote} className="vote-btn">
                    投票を作成
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Vote;
