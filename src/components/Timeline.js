import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Timeline.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment, faPlus, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { usePostManager } from './PostManager';
import AdComponent from './AdComponent';

const Timeline = () => {
    const [groupId, setGroupId] = useState(null);
    const [loading, setLoading] = useState(false);
    const { posts, setPosts, addPost, addComment, addToLibrary, fetchData } = usePostManager(groupId);
    const [newPostContent, setNewPostContent] = useState('');
    const [newCommentContent, setNewCommentContent] = useState('');
    const [isPostFormVisible, setIsPostFormVisible] = useState(false);
    const [isCommentFormVisible, setIsCommentFormVisible] = useState(null);
    const [notification, setNotification] = useState(null); 
    const [selectedUserId, setSelectedUserId] = useState(null); 
    const [currentUserId, setCurrentUserId] = useState(null);

    const maxLength = 300;
    const navigate = useNavigate();

    const API_URL = process.env.REACT_APP_API_URL;

    // groupIdの取得と投稿データの取得
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true); // ローディング開始
            try {
                // 投稿データを取得（group_idはバックエンドが管理）
                const response = await axios.get(`${API_URL}/api/posts`, { withCredentials: true });
                if (response.data.success) {
                    setPosts(response.data.posts || []);
                } else {
                    console.error('投稿データの取得に失敗しました:', response.data.message);
                }
            } catch (error) {
                console.error('データ取得エラー:', error.message);
            } finally {
                setLoading(false); // ローディング終了
            }
        };

        fetchData();
    }, []);

    const handleAddPost = async () => {
        if (!newPostContent.trim()) {
            alert('Post content cannot be empty.');
            return;
        }
        if (newPostContent.length > maxLength) {
            alert('Post exceeds the 300 characters limit.');
            return;
        }
        try {
            await addPost(newPostContent.trim(), groupId); // 投稿の追加処理を実行
            setNewPostContent('');
            setIsPostFormVisible(false);
        } catch (error) {
            alert('投稿の追加に失敗しました。');
            console.error('投稿追加エラー:', error);
        }
    };

    const handleAddComment = async (postId, commentContent) => {
        if (!commentContent.trim()) {
            alert('Comment content cannot be empty.');
            return;
        }
        if (commentContent.length > maxLength) {
            alert('Comment exceeds the 300 characters limit.');
            return;
        }
        try {
            await addComment(postId, commentContent.trim(), groupId);
            setNewCommentContent('');
            setIsCommentFormVisible(null);
            await fetchData(groupId); // コメント後に投稿データを再取得
        } catch (error) {
            alert('コメントの追加に失敗しました。');
            console.error('コメント追加エラー:', error);
        }
    };

    const toggleCommentFormVisibility = (postId) => {
        setIsCommentFormVisible((prevPostId) => (prevPostId === postId ? null : postId));
    };

    const hideMailIcon = () => {
        setSelectedUserId(null); // ユーザー選択をリセット
    };

    return (
        <div className="timeline">
            {notification && <div className="notification">{notification}</div>}
            <button className="add-post-btn" onClick={() => setIsPostFormVisible(true)}>
                <FontAwesomeIcon icon={faPlus} />
            </button>

            {/* 新しい投稿フォームの表示 */}
            {isPostFormVisible && (
                <div className="post-form-popup">
                    <div className="post-form-container">
                        <textarea
                            placeholder="New post..."
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                        />
                        <div className="post-form-buttons">
                            <button className="cancel" onClick={() => setIsPostFormVisible(false)}>キャンセル</button>
                            <button
                                onClick={handleAddPost}
                                disabled={newPostContent.length > maxLength}
                            >
                                投稿
                            </button>
                        </div>
                        <p>{newPostContent.length}/{maxLength}</p>
                    </div>
                </div>
            )}

            {posts.length === 0 ? (
                <p>投稿がありません</p>
            ) : (
                posts.map((post, index) => (
                    <React.Fragment key={post.id}>
                        <div className="post" onClick={hideMailIcon}>
                            <div className="post-header">
                                <img
                                    src={post.icon}
                                    alt={`${post.nickname || `user${post.id}`}のアイコン`}
                                    style={{ width: '50px', height: '50px' }}
                                    className="author-icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (post.userId !== currentUserId) {
                                            setSelectedUserId(post.userId);
                                        }
                                    }}
                                />
                                <p className="author-nickname">{post.nickname}</p>
                            </div>
                            <p className="post-content">{post.content}</p>
                            <div className="post-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="action-btn"
                                    onClick={() => toggleCommentFormVisibility(post.id)}
                                >
                                    <FontAwesomeIcon icon={faComment} />
                                </button>
                                <button
                                    className="action-btn"
                                    onClick={async () => {
                                        try {
                                            await addToLibrary(post.id);
                                            setNotification('ライブラリに追加しました');
                                            setTimeout(() => setNotification(null), 3000);
                                        } catch (error) {
                                            setNotification('ライブラリへの追加に失敗しました');
                                            setTimeout(() => setNotification(null), 3000);
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon icon={faClipboardList} />
                                </button>
                            </div>

                            {isCommentFormVisible === post.id && (
                                <div className="comment-form">
                                    <textarea
                                        value={newCommentContent}
                                        onChange={(e) => setNewCommentContent(e.target.value)}
                                        placeholder="Comment..."
                                    />
                                    <div className="comment-form-buttons">
                                        <button onClick={() => setIsCommentFormVisible(null)}>キャンセル</button>
                                        <button
                                            onClick={() => handleAddComment(post.id, newCommentContent)}
                                            disabled={newCommentContent.length > maxLength}
                                        >
                                            コメント
                                        </button>
                                    </div>
                                    <p>{newCommentContent.length}/{maxLength}</p>
                                </div>
                            )}

                            {post.comments && post.comments.length > 0 && (
                                <div className="comments">
                                    {post.comments.map((comment) => (
                                        <div key={comment.id} className="comment">
                                            <img
                                                src={comment.icon}
                                                alt={`${comment.nickname || '匿名ユーザー'}のアイコン`}
                                                className="comment-author-icon"
                                            />
                                            <div className="comments-content">
                                                <p className="comment-author-nickname">{comment.nickname || '匿名ユーザー'}</p>
                                                <p className="comment-text">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                    </React.Fragment>
                ))
            )}
        </div>
    );
};

export default Timeline;
