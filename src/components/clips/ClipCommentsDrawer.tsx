import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, User as UserIcon } from 'lucide-react';
import { Clip, ClipComment } from '../../types';

export interface ClipCommentsDrawerProps {
  isOpen: boolean;
  activeClip: Clip | null;
  comments: ClipComment[];
  commentText: string;
  isSubmittingComment: boolean;
  currentUser: any | null;
  language: 'en' | 'ka';
  onClose: () => void;
  onChangeCommentText: (text: string) => void;
  onSubmitComment: (e: React.FormEvent) => void;
}

export function ClipCommentsDrawer({
  isOpen,
  activeClip,
  comments,
  commentText,
  isSubmittingComment,
  currentUser: _currentUser,
  language,
  onClose,
  onChangeCommentText,
  onSubmitComment,
}: ClipCommentsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && activeClip && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
        >
          {/* Backdrop click interceptor */}
          <div
            onClick={onClose}
            className="absolute inset-0"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-zinc-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col max-h-[75vh] sm:max-h-[80vh] z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-purple-400" size={18} />
                <h3 className="font-extrabold text-white text-sm">
                  {language === 'ka' ? 'კომენტარები' : 'Comments'}
                  <span className="text-xs font-mono text-purple-400 ml-1.5 font-bold">
                    ({comments.length})
                  </span>
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3.5 my-4 pr-1 custom-scrollbar">
              {comments.length === 0 ? (
                <div className="py-12 text-center text-proton-muted space-y-2">
                  <MessageSquare className="mx-auto opacity-20" size={32} />
                  <p className="text-xs font-bold">
                    {language === 'ka' ? 'კომენტარები ჯერ არ არის' : 'No comments yet'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {language === 'ka' ? 'იყავით პირველი, ვინც დააკომენტარებს!' : 'Be the first to share your thoughts!'}
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/80 border border-white/10 overflow-hidden shrink-0 aspect-square flex items-center justify-center text-xs font-bold text-purple-300">
                      {comment.userAvatar ? (
                        <img 
                          referrerPolicy="no-referrer" 
                          src={comment.userAvatar} 
                          alt={comment.userName} 
                          className="w-full h-full object-cover aspect-square" 
                          loading="lazy" 
                        />
                      ) : (
                        <UserIcon size={14} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 bg-white/5 rounded-2xl p-3 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">
                          @{comment.userName}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed break-words font-sans">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={onSubmitComment} className="pt-2 border-t border-white/10 flex items-center gap-2 pb-safe">
              <input
                type="text"
                value={commentText}
                onChange={(e) => onChangeCommentText(e.target.value)}
                placeholder={language === 'ka' ? 'დაწერე კომენტარი...' : 'Add a comment...'}
                className="flex-1 bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none rounded-xl py-2.5 px-3.5 text-xs text-white placeholder:text-gray-500 transition-all font-sans"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white transition-all shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
