import { useEffect, useState } from 'react';
import { Post } from '../types/models';
import { getLikedPostIds } from '../services/likeService';

// 목록에 보이는 글들의 "내가 좋아요 눌렀는지"를 한 번에 조회한다.
// 이걸 쓰지 않으면 PostCard가 카드마다 따로 조회해서 글 개수만큼 읽기가 나간다.
// 페이지네이션이 없는 목록(프로필, 저장한 글 등)에 쓰기 좋다.
export function useLikedPosts(posts: Post[], userId?: string): Set<string> {
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || posts.length === 0) {
      setLikedPostIds(new Set());
      return;
    }
    // 목록이 바뀌는 도중에 이전 조회 결과가 뒤늦게 덮어쓰지 않도록 막는다.
    let cancelled = false;
    getLikedPostIds(
      posts.map((p) => p.id),
      userId
    )
      .then((ids) => {
        if (!cancelled) setLikedPostIds(ids);
      })
      .catch(() => {
        // 좋아요 표시는 부가 정보라, 실패해도 목록은 그대로 보여준다.
      });
    return () => {
      cancelled = true;
    };
  }, [posts, userId]);

  return likedPostIds;
}
