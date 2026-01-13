import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Route, Routes, Link, Navigate } from 'react-router-dom';
import Timeline from './components/Timeline';
import Library from './components/Library';
import History from './components/History';
import Vote from './components/Vote';
import ProfilePage from './components/ProfilePage';
import TermsModal from './components/TermsModal'; 
import { FaHome, FaClipboardList, FaScroll, FaVoteYea, FaUser } from 'react-icons/fa';
import './App.css';

const App = () => {
    const [loading, setLoading] = useState(true); 
    const [inputKey, setInputKey] = useState('');
    const [generatedKey, setGeneratedKey] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [nickname, setNickname] = useState('');
    const [iconPreview, setIconPreview] = useState('');
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [groupId, setGroupId] = useState(null);

    const openTerms = () => setIsTermsOpen(true);
    const closeTerms = () => setIsTermsOpen(false);
    
    const API_URL = process.env.REACT_APP_API_URL;

    const handleLoginAndInitialize = async () => {
        try {
            const response = await axios.post(
                `${API_URL}/api/login`,
                { secretKey: inputKey },
                { withCredentials: true }
            );
    
            if (response.data.success) {
                const user = response.data.user || {};
                const { id, nickname, icon, group_id } = user;
    
                if (!id || !nickname || !group_id) {
                    throw new Error('handleLoginAndInitialize: User data is incomplete');
                }
    
                localStorage.setItem('nickname', nickname);
                localStorage.setItem('icon', icon);
    
                setIsLoggedIn(true);
                await fetchUserData();
                await checkUserStatus();
            } else {
                alert('ログイン失敗: 無効な秘密鍵です');
            }
        } catch (error) {
            console.error('handleLoginAndInitialize: Error during login and initialization:', error.message);
            alert('サーバーエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        try {
            const response = await axios.post(`${API_URL}/api/create-account`);
            if (response.data.success) {
                const { secretKey, nickname, icon, groupId } = response.data;

                localStorage.setItem('nickname', nickname);
                localStorage.setItem('icon', icon);

                setGeneratedKey(secretKey);
                setGroupId(groupId);
            } else {
                console.error('handleCreateAccount: Account creation failed');
                alert('アカウント作成失敗');
            }
        } catch (error) {
            console.error('handleCreateAccount: Error creating account:', error.message);
            alert('サーバーエラーが発生しました');
        }
    };

    
    const fetchUserData = async () => {
        try {
            const response = await axios.post(
                `${API_URL}/api/users/me`,
                {},
                { withCredentials: true }
            );
    
            if (response.data.success) {
                let { nickname, icon } = response.data.user;
    
                setNickname(nickname);
                setIconPreview(icon);
            } else {
                console.error('ユーザー情報取得失敗:', response.data.error);
            }
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('セッションが切れました。再ログインしてください。');
                alert('セッションが切れました。再ログインしてください。');
                localStorage.clear();
                setIsLoggedIn(false);
            } else {
                console.error('Error fetching user data:', error.message);
            }
        }
    };

    
    const checkUserStatus = async () => {
        try {
            const response = await axios.post(
                `${API_URL}/api/users/check-status`,
                {},
                { withCredentials: true }
            );
    
            if (response.data.isDeleted) {
                alert('ユーザーは削除されました');
                localStorage.clear();
                setIsLoggedIn(false);
            }
        } catch (error) {
            console.error('checkUserStatus: Error checking status:', error.message);
        }
    };

    useEffect(() => {
        const restoreLoginState = async () => {
            const nickname = localStorage.getItem('nickname');
            let icon = localStorage.getItem('icon');
        
            if (nickname) {
                setNickname(nickname);
                setIconPreview(icon);
                setIsLoggedIn(true);
        
                try {
                    await fetchUserData(); 
                    await checkUserStatus();
                } catch (error) {
                    console.error('Error during user data restoration:', error.message);
                }
            }
            setLoading(false);
        };
    
        restoreLoginState();
    }, []);      

    return (
            <Router>
                <div className="app">
                    <header className="header">
                        <h1>folkout</h1>
                        <nav>
                            <Link to="/"><FaHome size={24} /></Link>
                            <Link to="/library"><FaClipboardList size={24} /></Link>
                            <Link to="/vote"><FaVoteYea size={24} /></Link>
                            <Link to="/history"><FaScroll size={24} /></Link>
                            <Link to="/profile"><FaUser size={24} /></Link>
                        </nav>
                    </header>
                    <main>
                        {!isLoggedIn ? (
                            <div className="center-container">
                                <div>
                                    <input
                                        type="text"
                                        value={inputKey}
                                        onChange={(e) => setInputKey(e.target.value)}
                                        placeholder="秘密鍵を入力"
                                    />
                                    <button onClick={handleLoginAndInitialize}>ログイン</button>
                                </div>
                                <div>
                                    <button onClick={openTerms} className="terms-button">
                                        利用規約
                                    </button>
                                    <TermsModal isOpen={isTermsOpen} onClose={closeTerms} />
                                </div>
                                <button
                                    onClick={handleCreateAccount}
                                    className="create-account-btn"
                                >
                                    新規アカウント作成
                                </button>
                                {generatedKey && (
                                    <div className="generated-key">
                                        <p>生成された秘密鍵: <strong>{generatedKey}</strong></p>
                                        <p>この秘密鍵を安全な場所に保管してください。紛失するとアカウントを復元できません。</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Routes>
                                <Route path="/" element={<Navigate to="/timeline" />} />
                                <Route path="/timeline" element={<Timeline/>} />
                                <Route path="/library" element={<Library/>} />
                                <Route path="/vote" element={<Vote/>} />
                                <Route path="/history" element={<History/>} />
                                <Route path="/profile" element={<ProfilePage/>} />
                            </Routes>
                        )}
                    </main>
                </div>
            </Router>
    );
};

export default App;