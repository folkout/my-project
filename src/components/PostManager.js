import React, { useState, useEffect } from 'react';
import axios from 'axios';

export const usePostManager = () => {
    const [groupId, setGroupId] = useState(null);
    const [posts, setPosts] = useState([]); // 投稿一覧
    const [savedPosts, setSavedPosts] = useState([]); // ライブラリに保存された投稿
    const [error, setError] = useState(null); // エラーステート

    const API_URL = process.env.REACT_APP_API_URL;

    // 投稿の取得処理
    const fetchData = async () => {
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
        }
    };

    // 投稿の追加
    const addPost = async (content) => {

        if (!content || content.trim() === '') {
            console.error('Content is empty or invalid'); // エラーをログ出力
            return;
        }

        try {
            const response = await axios.post(
                `${API_URL}/api/posts`,
                { content },
                { withCredentials: true }
            );

            const { postId, created_at } = response.data;
            setPosts((prevPosts) => [
                {
                    id: postId,
                    content,
                    created_at,
                    comments: [],
                },
                ...prevPosts,
            ]);
        } catch (error) {
            console.error('投稿の追加に失敗しました:', error.message);
        }
    };

    // コメントを追加
    const addComment = async (postId, commentContent) => {
        try {
            const response = await axios.post(
                `${API_URL}/api/posts/${postId}/comments`,
                { content: commentContent.trim() }, // group_id を削除
                { withCredentials: true }
            );
            const newComment = response.data.comment;
            setPosts((prevPosts) =>
                prevPosts.map((post) =>
                    post.id === postId
                        ? {
                            ...post,
                            comments: [
                                ...post.comments,
                                {
                                    id: newComment.id,
                                    content: newComment.content,
                                    created_at: new Date().toISOString(),
                                    nickname: newComment.nickname,
                                    icon: newComment.icon,
                                },
                            ],
                        }
                        : post
                )
            );
        } catch (error) {
            console.error('コメント追加に失敗しました:', error.message);
        }
    };

    // ライブラリに投稿を追加
    const addToLibrary = async (postId) => {
        try {
            const confirmAdd = window.confirm('この投稿をライブラリに追加しますか？');
            if (!confirmAdd) return;

            const response = await axios.post(
                `${API_URL}/api/posts/${postId}/add-to-library`,
                {}, // リクエストボディを空にする
                { withCredentials: true } // クッキーを送信
            );

            if (response.data.success) {
                console.log('ライブラリに追加成功:', response.data);
                alert('投稿がライブラリに追加されました');
            } else {
                alert(response.data.message || 'ライブラリ追加に失敗しました');
            }
        } catch (error) {
            console.error('ライブラリ追加エラー:', error.response?.data || error.message);
            alert('ライブラリ追加中にエラーが発生しました');
        }
    };

    // 共通エラー処理
    const handleError = (error, defaultMessage) => {
        if (error.response) {
            console.error('APIエラー:', error.response);
            setError(error.response.data.error || defaultMessage);
        } else {
            console.error('ネットワークエラー:', error);
            setError(defaultMessage);
        }
    };

    // 初回データ取得
    useEffect(() => {
        if (!groupId) return; // groupId が未定義なら実行しない
        fetchData();
    }, [groupId]); // groupId を監視

    return {
        posts,
        setPosts,
        savedPosts,
        error,
        addPost,
        addComment,
        addToLibrary,
        fetchData,
    };
};
