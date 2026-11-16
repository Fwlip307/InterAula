import type { AuthenticatedUser } from '../../types/index.js';
import { HttpError } from '../../lib/httpError.js';
import { mapPostToDto, mapReplyToDto, type ForumQueryOptions } from '../forum.service.js';
import { clientFor, result, existing, attachProfiles } from './database.js';

async function postDto(row:any,userId?:string,token?:string):Promise<any> {
  const [joined]=await attachProfiles([row],'author_id','author',token);
  const votes=userId?await result(clientFor(token).from('forum_post_votes').select('post_id').eq('post_id',row.id).eq('user_id',userId)):[];
  return mapPostToDto(joined,userId,new Set(votes.map((vote:any)=>vote.post_id)));
}
export const remoteForumService = {
  async getPosts(options:ForumQueryOptions={}):Promise<any[]> {
    let query=clientFor(options.token).from('forum_posts').select('*').order('created_at',{ascending:false});
    if(options.category&&options.category!=='all')query=query.eq('category',options.category);
    if(options.postType&&options.postType!=='all')query=query.eq('post_type',options.postType);
    if(options.subjectId&&options.subjectId!=='all')query=query.eq('subject_id',options.subjectId);
    if(options.status&&options.status!=='all')query=query.eq('is_solved',options.status==='solved');
    const rows:any[]=await result(query);
    const joined=await attachProfiles(rows,'author_id','author',options.token);
    const votes=options.currentUserId?await result(clientFor(options.token).from('forum_post_votes').select('post_id').eq('user_id',options.currentUserId)):[];
    const ids=new Set<string>(votes.map((vote:any)=>vote.post_id));
    let posts=joined.map(row=>mapPostToDto(row,options.currentUserId,ids));
    if(options.search){const term=options.search.toLowerCase();posts=posts.filter(post=>[post.title,post.description,post.category,...post.tags].join(' ').toLowerCase().includes(term));}
    if(options.sort==='popular')posts.sort((a,b)=>b.votesCount-a.votesCount);
    if(options.sort==='activity')posts.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return posts;
  },
  async getPostById(id:string,userId?:string,token?:string):Promise<any> {
    const row=await result(clientFor(token).from('forum_posts').select('*').eq('id',id).maybeSingle());
    return row?{...await postDto(row,userId,token),replies:await this.getReplies(id,token)}:null;
  },
  async getReplies(id:string,token?:string):Promise<any[]> {
    const rows=await result(clientFor(token).from('forum_replies').select('*').eq('post_id',id).order('is_accepted',{ascending:false}).order('created_at'));
    return (await attachProfiles(rows,'author_id','author',token)).map(mapReplyToDto);
  },
  async createPost(user:AuthenticatedUser,token:string,body:Record<string,any>):Promise<any> {
    const row=await result(clientFor(token).from('forum_posts').insert({...body,author_id:user.id,votes_count:0,replies_count:0,is_solved:false}).select('*').single());
    return postDto(row,user.id,token);
  },
  async updatePost(user:AuthenticatedUser,token:string,id:string,body:Record<string,any>):Promise<any> {
    const row=await existing(clientFor(token).from('forum_posts').update({...body,updated_at:new Date().toISOString()}).eq('id',id).eq('author_id',user.id).select('*').maybeSingle(),'Solo el autor puede editar esta publicación.');
    return postDto(row,user.id,token);
  },
  async deletePost(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await existing(clientFor(token).from('forum_posts').delete().eq('id',id).eq('author_id',user.id).select('id').maybeSingle(),'Solo el autor puede eliminar esta publicación.');
    return {success:true,id};
  },
  async upvotePost(id:string,user?:AuthenticatedUser,token?:string):Promise<any> {
    if(!user||!token)throw new HttpError(401,'Debes iniciar sesión para votar.');
    return result(clientFor(token).rpc('toggle_forum_vote',{p_post_id:id}));
  },
  async toggleSolved(user:AuthenticatedUser,token:string,id:string,isSolved?:boolean):Promise<any> {
    const current=await existing(clientFor(token).from('forum_posts').select('is_solved').eq('id',id).eq('author_id',user.id).maybeSingle(),'Solo el autor puede resolver esta consulta.');
    return result(clientFor(token).rpc('resolve_forum_post',{p_post_id:id,p_reply_id:null,p_solved:typeof isSolved==='boolean'?isSolved:!current.is_solved}));
  },
  async createReply(user:AuthenticatedUser,token:string,id:string,content:string):Promise<any> {
    const row=await result(clientFor(token).from('forum_replies').insert({post_id:id,author_id:user.id,content:content.trim()}).select('*').single());
    return mapReplyToDto((await attachProfiles([row],'author_id','author',token))[0]);
  },
  async updateReply(user:AuthenticatedUser,token:string,id:string,content:string):Promise<any> {
    const row=await existing(clientFor(token).from('forum_replies').update({content:content.trim(),updated_at:new Date().toISOString()}).eq('id',id).eq('author_id',user.id).select('*').maybeSingle(),'Solo el autor puede editar esta respuesta.');
    return mapReplyToDto((await attachProfiles([row],'author_id','author',token))[0]);
  },
  async deleteReply(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await existing(clientFor(token).from('forum_replies').delete().eq('id',id).eq('author_id',user.id).select('id').maybeSingle(),'Solo el autor puede eliminar esta respuesta.');
    return {success:true,id};
  },
  async markReplyAsSolution(_user:AuthenticatedUser,token:string,id:string,replyId:string):Promise<any> {
    return result(clientFor(token).rpc('resolve_forum_post',{p_post_id:id,p_reply_id:replyId,p_solved:true}));
  },
};
