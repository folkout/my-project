import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTags, faComments, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Library.css';

const Library = () => {
    const [posts, setPosts] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [tags, setTags] = useState([]);
    const [newTag, setNewTag] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [activeTagId, setActiveTagId] = useState(null);
    const [isTagFormVisible, setTagFormVisible] = useState(false);
    const tagPopupRef = useRef(null);
    const tagManagerRef = useRef(null);
    const [popupOpen, setPopupOpen] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null); 
    const [currentUserId, setCurrentUserId] = useState(() => {
        const storedUserId = localStorage.getItem('user_id');
        return storedUserId ? parseInt(storedUserId, 10) : null;
    });
    const [groupId, setGroupId] = useState(() => {
        const storedGroupId = localStorage.getItem('group_id');
        return storedGroupId ? parseInt(storedGroupId, 10) : 1; // デフォルト値を1に設定
    });
    const [currentGroupId, setCurrentGroupId] = useState(() => {
        const storedGroupId = localStorage.getItem('group_id');
        return storedGroupId ? parseInt(storedGroupId, 10) : 1; // デフォルト値を1に設定
    });
    const [isRepresentative, setIsRepresentative] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL;

    // ポップアップ外をクリックした時の処理を改良
    useEffect(() => {
        const handleOutsideClick = (event) => {
            // タグポップアップを閉じる
            if (activeTagId && tagPopupRef.current && !tagPopupRef.current.contains(event.target)) {
                setActiveTagId(null);
            }
    
            // タグ管理ポップアップを閉じる
            if (isTagFormVisible && tagManagerRef.current && !tagManagerRef.current.contains(event.target)) {
                setTagFormVisible(false);
            }
    
            // DMアイコンを非表示
            const mailIcon = document.querySelector('.mail-icon');
            if (mailIcon && !mailIcon.contains(event.target)) {
                setSelectedUserId(null);
            }
        };
    
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [activeTagId, isTagFormVisible, tagPopupRef, tagManagerRef]);

    useEffect(() => {
        const fetchLibraryPosts = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/posts/is_in_library`, {
                    withCredentials: true, // クッキーを送信
                });
    
                if (response.status === 200 && Array.isArray(response.data.library)) {
                    const libraryPosts = await Promise.all(
                        response.data.library.map(async (post) => {
                            try {
                                const editor = await fetchUserById(post.last_editor_id); // 最終編集者情報の取得
                                const author = await fetchUserById(post.user_id); // 投稿者情報の取得
                                return {
                                    ...post,
                                    postAuthorName: post.post_nickname || '不明',
                                    postAuthorIcon: post.post_icon || null,
                                    lastEditorName: post.last_editor_nickname || '不明',
                                };
                            } catch {
                                return { ...post, lastEditorName: '取得失敗' };
                            }
                        })
                    );
                    setPosts(libraryPosts);
                    setError(null);
                } else {
                    console.log('ライブラリ投稿が見つかりませんでした');
                    setPosts([]);
                }
            } catch (error) {
                console.error('ライブラリの取得に失敗しました:', error);
                setError('ライブラリの取得に失敗しました');
            }
        };
    
        const fetchUserById = async (userId) => {
            try {
                const response = await axios.get(`${API_URL}/api/users/${userId}`, {
                    withCredentials: true, // クッキーを送信
                });
                return response.data.user;
            } catch (error) {
                console.error(`ユーザーID ${userId} の取得に失敗しました:`, error);
                return null;
            }
        };
    
        const fetchTags = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/tags`, {
                    withCredentials: true, // クッキーを送信
                });
    
                if (response.status === 200 && Array.isArray(response.data.tags)) {
                    setTags(response.data.tags);
                } else {
                    console.error('タグ取得失敗:', response.data.message);
                    setTags([]);
                }
            } catch (error) {
                console.error('タグ取得エラー:', error);
                if (error.response?.status === 403) {
                    console.warn('403 Forbidden: group_idの不正または認証エラー');
                }
            }
        };
    
        fetchLibraryPosts();
        fetchTags();
    }, []);    
    
    const addTag = async () => {
        if (!newTag.trim()) {
            console.error('タグ名が空です');
            return;
        }
    
        try {
            const response = await axios.post(
                `${API_URL}/api/tags`,
                { name: newTag.trim() }, // group_id を削除
                { withCredentials: true } // クッキーを送信
            );
    
            if (response.data.success) {
                setTags([response.data.tag, ...tags]); // タグ一覧を更新
                setNewTag('');
            }
        } catch (error) {
            console.error('タグ作成エラー:', error);
        }
    };    
    
    // フィルタリングされた投稿一覧を取得
    const filteredPosts = posts
        .filter(post => {
            const matchesContent = post.content?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTag = selectedTag === '' || post.tag === selectedTag; // post.tagを直接使用
            return matchesContent && matchesTag;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const deleteTag = async (tagId) => {
            try {
                const confirmDelete = window.confirm(
                    '関連する投稿まで削除される恐れがあります。本当に削除しますか？'
                );
                if (!confirmDelete) return;
        
                const response = await axios.delete(
                    `${API_URL}/api/tags/${tagId}`,
                    {
                        withCredentials: true, // Cookieを送信
                    }
                );
        
                if (response.data.success) {
                    alert('タグ削除が完了しました');
                    setTags((prevTags) => prevTags.filter((tag) => tag.id !== tagId)); // タグ一覧を更新
                } else {
                    alert(response.data.message || 'タグ削除に失敗しました');
                }
            } catch (error) {
                if (error.response?.status === 403) {
                    alert('代表者のみタグ削除が可能です');
                } else {
                    console.error('タグ削除エラー:', error.response?.data || error.message);
                    alert('タグ削除中にエラーが発生しました');
                }
            }
        };    

    const hideMailIcon = () => {
        setSelectedUserId(null); // ユーザー選択をリセット
    };

    return (
        <div className="library-container">
            <h1 className="library-title">ライブラリ</h1>
    
            {/* 検索ボックス */}
            <div className="search-container">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                    type="text"
                    placeholder="検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>
    
            {/* タグ表示エリア */}
            <div className="tags-area">
                {tags.map((tag) => (
                    <span
                        key={tag.id}
                        className={`tag ${selectedTag === tag.name ? 'active' : ''}`}
                        onClick={() => setSelectedTag(selectedTag === tag.name ? '' : tag.name)}
                    >
                        {tag.name}
                    </span>
                ))}
            </div>

            <div className="post-cards">
                {filteredPosts.map(post => (
                    <div key={post.id} className="post-card">
                        {/* 投稿内容 */}
                        <div className="post-card-content">
                        <div className="author-info" onClick={hideMailIcon}>
                        <img
                            src={post.postAuthorIcon}
                            alt={`${post.postAuthorName}のアイコン`}
                            style={{ width: '50px', height: '50px' }}
                            className="author-icon"
                            onClick={(e) => {
                                e.stopPropagation(); // クリックイベントの伝播を防止
                                setSelectedUserId(post.id); // 投稿者を選択
                            }}
                        />
                            <p className="author-nickname">{post.postAuthorName}</p>
                        </div>
                        <p className="post-content">{post.content}</p>
                        </div>
                            
                        {/* フッター */}
                        <div className="post-card-footer">
                            <div className="post-tags-inline">
                                {post.tag && <span className="tag">{post.tag}</span>}
                            </div>
                            <p className="post-last-editor">{post.lastEditorName}</p>
                            <div className="icon-group">
                                {/* コメントアイコン */}
                                <FontAwesomeIcon
                                    icon={faComments}
                                    onClick={() => setPopupOpen(post.id)} // オーバーレイを開く
                                    className="icon"
                                    title="コメントを見る"
                                />
    
                                {/* タグアイコン */}
                                <FontAwesomeIcon
                                    icon={faTags}
                                    onClick={() => {
                                        setActiveTagId(activeTagId === post.id ? null : post.id);
                                        setPopupOpen(null);
                                    }}
                                    className="icon-faTags"
                                />
                                {activeTagId === post.id && (
                                    <div className="tag-select-popup" ref={tagPopupRef}>
                                        {tags.map((tag) => (
                                            <span
                                                key={tag.id}
                                                className={`tag-option ${tag.name === post.tag ? 'active' : ''}`} // 現在のタグを強調
                                                onClick={async () => {
                                                    try {

                                                        if (!tag.name || tag.name.trim() === '') {
                                                            console.error('無効なタグ名です');
                                                            return;
                                                        }

                                                        const response = await axios.put(
                                                            `${API_URL}/api/posts/${activeTagId}/tag`,
                                                            { tag_name: tag.name.trim() }, // リクエストボディにタグ名のみ送信
                                                            { withCredentials: true } // Cookieを送信
                                                        );

                                                        if (response.data.success) {
                                                            setPosts((prevPosts) =>
                                                                prevPosts.map((post) =>
                                                                    post.id === activeTagId ? { ...post, tag: tag.name } : post
                                                                )
                                                            );
                                                        } else {
                                                            console.error('タグの設定に失敗しました:', response.data);
                                                        }
                                                    } catch (error) {
                                                        console.error('タグ設定エラー:', error);
                                                    } finally {
                                                        setActiveTagId(null); // アクティブ状態を解除
                                                    }
                                                }}
                                            >
                                                {tag.name || '未設定'}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* タグ管理ボタン */}
            <div 
                className="tag-command" 
                onClick={() => setTagFormVisible((prevState) => !prevState)}
            >
                <FontAwesomeIcon icon={faTags} className="tag-command-icon" />
            </div>

            {isTagFormVisible && (
                <div className="tag-management-popup" ref={tagManagerRef}>
                    <h3>タグ管理</h3>
                    <div className="tag-count">
                        <p>{tags.length}/10</p>
                    </div>
                    <div className="tag-input-section">
                        <input
                            type="text"
                            placeholder="新しいタグを追加"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            className="tag-input"
                        />
                        <button onClick={addTag} className="tag-add-button">追加</button>
                    </div>
                    <div className="tag-list">
                        {tags.map((tag) => (
                            <div key={tag.id} className="tag-item">
                                <span>{tag.name}</span>
                                <button
                                    onClick={() => deleteTag(tag.id)}
                                    className="tag-delete-button"
                                >
                                    削除
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        
    
            {/* オーバーレイ */}
            {popupOpen && (
            <div
                className="fullscreen-overlay"
                onClick={() => setPopupOpen(null)} // オーバーレイ外をクリックすると閉じる
            >
                <div
                    className="overlay-content"
                    onClick={(e) => e.stopPropagation()} // 中身をクリックしても閉じない
                >

                    {/* 投稿情報 */}
                    <div className="overlay-post">
                        <div className="post-header">
                            <img src={filteredPosts.find(post => post.id === popupOpen)?.postAuthorIcon} alt="icon" className="post-icon" />
                            <div className="post-header-details">
                            <p className="author-nickname">{filteredPosts.find(post => post.id === popupOpen)?.postAuthorName}</p>
                                <small className="date">{new Date(filteredPosts.find(post => post.id === popupOpen)?.created_at).toLocaleString()}</small>
                            </div>
                        </div>
                        <p className="post-content">{filteredPosts.find(post => post.id === popupOpen)?.content}</p>
                    </div>


                    {/* コメント一覧 */}
                    <div className="overlay-comments">
                        {filteredPosts.find(post => post.id === popupOpen)?.comments.length > 0 ? (
                            filteredPosts.find(post => post.id === popupOpen)?.comments.map(comment => (
                                <div key={comment.id} className="comment-item">
                                    <div className="comment-header">
                                        <div className="comment-header-details">
                                        <h5 className="nickname">
                                        {filteredPosts.find(post => post.id === popupOpen)?.comments.find(c => c.id === comment.id)?.nickname || '不明'}
                                        </h5>
                                            <small className="date">{new Date(comment.created_at).toLocaleString()}</small>
                                        </div>
                                    </div>
                                    <p className="comment-content">{comment.content}</p>
                                </div>
                            ))
                        ) : (
                            <p>　</p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </div>
    );    
};

export default Library;
