import React, { useState, useEffect } from 'react';
import axios from 'axios';

export const usePostManager = () => {
    const [groupId, setGroupId] = useState(null);
    const [posts, setPosts] = useState([]); 
    const [savedPosts, setSavedPosts] = useState([]); 
    const [error, setError] = useState(null); 

    const API_URL = process.env.REACT_APP_API_URL;

    
    const fetchData = async () => {
        try {
            
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

    
    const addPost = async (content) => {

        if (!content || content.trim() === '') {
            console.error('Content is empty or invalid'); 
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

    
    const addComment = async (postId, commentContent) => {
        try {
            const response = await axios.post(
                `${API_URL}/api/posts/${postId}/comments`,
                { content: commentContent.trim() }, 
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

    
    const addToLibrary = async (postId) => {
        try {
            const confirmAdd = window.confirm('この投稿をライブラリに追加しますか？');
            if (!confirmAdd) return;

            const response = await axios.post(
                `${API_URL}/api/posts/${postId}/add-to-library`,
                {}, 
                { withCredentials: true } 
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

    
    const handleError = (error, defaultMessage) => {
        if (error.response) {
            console.error('APIエラー:', error.response);
            setError(error.response.data.error || defaultMessage);
        } else {
            console.error('ネットワークエラー:', error);
            setError(defaultMessage);
        }
    };

    
    useEffect(() => {
        if (!groupId) return; 
        fetchData();
    }, [groupId]); 

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
