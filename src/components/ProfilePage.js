import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfilePage.css';

const ProfilePage = () => {
    const [nickname, setNickname] = useState(''); // ニックネーム
    const [icon, setIcon] = useState(''); // アイコンURL
    const [iconPreview, setIconPreview] = useState(''); // アイコンプレビュー
    const [isEditing, setIsEditing] = useState(false); // 編集モード
    const [message, setMessage] = useState(''); // メッセージ表示用
    const [loading, setLoading] = useState(true); // ローディング状態
    const [userId, setUserId] = useState(null);
    const [announcement, setAnnouncement] = useState(''); // アナウンス用の状態
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL;

    // 認証済みユーザー情報の取得
    const fetchUserData = async () => {
        try {
            const response = await axios.post(
                `${API_URL}/api/users/me`,
                {},
                { withCredentials: true } // Cookieを送信
            );
    
            if (response.data.success) {
                const { nickname, icon } = response.data.user;
    
                setNickname(nickname);
                setIconPreview(icon);
            } else {
                console.error('ユーザー情報取得失敗:', response.data.error);
            }
        } catch (error) {
            console.error('Error fetching user data:', error.message); // エラーログ
        } finally {
            setLoading(false); // ロード完了
        }
    };

    // 初回ロード時にデータを取得
    useEffect(() => {
        fetchUserData();
    }, []);

    // ニックネーム変更時のハンドラー
    const handleNicknameChange = (e) => {
        setNickname(e.target.value);
    };

    // アイコン変更時のハンドラー
    const handleIconChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setIcon(file);
            setIconPreview(previewUrl); // プレビュー用URLを生成
        }
    };

    // 保存処理
    const handleSave = async () => {
        try {
            const formData = new FormData();
            if (nickname.trim()) formData.append('nickname', nickname.trim());
            if (icon && typeof icon !== 'string') formData.append('icon', icon); // iconが空の場合送信しない

            const response = await axios.put(
                `${API_URL}/api/users/settings`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true }
            );

            if (response.status === 200 && response.data.success) {
                setMessage('設定が正常に保存されました！');

                // フロントエンドの状態を更新
                const { nickname: newNickname, icon: newIcon } = response.data.user;
                setNickname(newNickname);
                setIconPreview(newIcon);
                setIsEditing(false);
            } else {
                setMessage('設定の更新に失敗しました。');
                console.error('Save failed:', response.data.error);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            setMessage('設定の保存中にエラーが発生しました。');
        }
    };   

// アカウント削除
const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
        '実行するとアカウントが失われます。本当に削除しますか？'
    );
    if (!confirmDelete) return;

    try {
        const response = await axios.delete(`${API_URL}/api/users/delete`, {
            withCredentials: true, // Cookieを送信
        });

        if (response.status === 200) {
            // アカウント削除成功時の処理
            localStorage.clear(); // ローカルストレージをクリア
            setIsLoggedIn(false); // ログイン状態を解除
            alert('アカウントが削除されました');
            window.location.href = '/login'; // 明示的にログイン画面へ遷移
        } else {
            setAnnouncement('Failed to delete account. Please try again later.');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        setAnnouncement('Failed to delete account. Please try again later.');
    }
};

    return (
        <div className="profile-page">
            {loading ? (
                <p>データを読み込んでいます...</p>
            ) : (
                <>
                {message && (
                    <div className="message-container">
                        <p className="message">{message}</p>
                    </div>
                )}
                    <div className="profile-header">
                        {isEditing ? (
                            <>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleIconChange}
                                />
                                {iconPreview && (
                                    <img
                                        src={iconPreview}
                                        alt="アイコンプレビュー"
                                        className="profile-icon"
                                    />
                                )}
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={handleNicknameChange}
                                    placeholder="ニックネームを入力"
                                />
                            </>
                        ) : (
                            <>
                                <img
                                    src={iconPreview}
                                    alt="User Icon"
                                    className="profile-icon"
                                />
                                <h2>{nickname}</h2>
                            </>
                        )}
                    </div>
                    <div className="profile-actions">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)}>キャンセル</button>
                                <button onClick={handleSave}>保存</button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)}>編集</button>
                        )}
                    </div>

                    <div>
                    <button className="delete-button" onClick={handleDeleteAccount}>アカウント削除</button>
                    {announcement && <p className="announcement">{announcement}</p>}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProfilePage;
