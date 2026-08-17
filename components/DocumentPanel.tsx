'use client';

import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle2, Clock, Loader2, FileImage, Eye, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL, getMetadata, deleteObject } from 'firebase/storage';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Reservation } from '@/types';
import { format } from 'date-fns';

interface UploadedDocument {
  url: string;
  name: string;
  uploadedAt: number;
  type: string;
}

interface DocumentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  reservation: Reservation | undefined;
  isDarkMode: boolean;
  viewOnly?: boolean;
  isLocalOnly?: boolean;
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'compressing' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export default function DocumentPanel({ isOpen, onClose, reservationId: rawReservationId, reservation, isDarkMode, viewOnly, isLocalOnly: rawIsLocalOnly = false, onDocumentsChange }: DocumentPanelProps) {
  // Clean reservationId and provide a fallback if it is undefined or 'undefined'
  // Stabilize with useMemo to prevent generating a new random ID on every render
  const reservationId = React.useMemo(() => {
    if (!rawReservationId || rawReservationId === "undefined" || rawReservationId === "null") {
      return `temp_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    }
    return rawReservationId;
  }, [rawReservationId]);

  const isLocalOnly = rawIsLocalOnly || reservationId.startsWith('temp_');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const [validDocs, setValidDocs] = useState<UploadedDocument[]>(reservation?.uploadedDocuments || []);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeletingUrl, setIsDeletingUrl] = useState<string | null>(null);

  const prevUrlsRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadAndValidateDocs = async () => {
      setIsValidating(true);
      let currentDocs: UploadedDocument[] = [];

      // Lazy-load complete document payload directly from Firestore for existing reservations
      if (!isLocalOnly && reservationId && !reservationId.startsWith('temp_')) {
        try {
          const docSnap = await getDoc(doc(db, 'reservations', reservationId));
          if (docSnap.exists()) {
            const docData = docSnap.data();
            currentDocs = (docData.uploadedDocuments || []) as UploadedDocument[];
          } else {
            currentDocs = reservation?.uploadedDocuments || [];
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch reservation documents on-demand, using fallback:", fetchErr);
          currentDocs = reservation?.uploadedDocuments || [];
        }
      } else {
        currentDocs = reservation?.uploadedDocuments || [];
      }

      if (!isMounted) return;

      const urlsStr = currentDocs
        .map(d => d.url)
        .sort()
        .join(',');

      if (prevUrlsRef.current === urlsStr && validDocs.length > 0) {
        setIsValidating(false);
        return;
      }
      prevUrlsRef.current = urlsStr;

      const checkedList: UploadedDocument[] = [];
      const invalidList: UploadedDocument[] = [];

      for (const docItem of currentDocs) {
        if (docItem.url && docItem.url.startsWith('data:')) {
          checkedList.push(docItem);
          continue;
        }
        try {
          const storageRef = ref(storage, docItem.url);
          await getMetadata(storageRef);
          checkedList.push(docItem);
        } catch (error: unknown) {
          console.warn(`Document file missing in Firebase Storage: ${docItem.name}`, error);
          invalidList.push(docItem);
        }
      }

      if (!isMounted) return;

      setValidDocs(checkedList);
      setIsValidating(false);

      // Clean up Firestore if some files are no longer in Storage
      if (invalidList.length > 0 && !viewOnly) {
        if (isLocalOnly) {
          setTimeout(() => {
            onDocumentsChange?.(checkedList);
          }, 0);
        } else {
          try {
            const resRef = doc(db, 'reservations', reservationId);
            const updatedDocs = currentDocs.filter(
              d => !invalidList.some(inv => inv.url === d.url)
            );
            await updateDoc(resRef, {
              uploadedDocuments: updatedDocs,
              updatedAt: Date.now()
            });
            setTimeout(() => {
              onDocumentsChange?.(updatedDocs);
            }, 0);
          } catch (err) {
            console.error("Failed to clean up deleted Firestore document array:", err);
          }
        }
      }
    };

    loadAndValidateDocs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, reservationId, isLocalOnly, viewOnly, onDocumentsChange]);

  const handleDeleteDoc = async (docItem: UploadedDocument) => {
    if (viewOnly) return;
    setIsDeletingUrl(docItem.url);
    try {
      const storageRef = ref(storage, docItem.url);
      try {
        await deleteObject(storageRef);
      } catch (storageErr: unknown) {
        const errWithCode = storageErr as { code?: string };
        if (errWithCode.code !== 'storage/object-not-found') {
          console.error("Storage delete failed:", storageErr);
        }
      }

      const remainingDocs = validDocs.filter(d => d.url !== docItem.url);
      if (isLocalOnly) {
        setValidDocs(remainingDocs);
        onDocumentsChange?.(remainingDocs);
      } else {
        const resRef = doc(db, 'reservations', reservationId);
        await updateDoc(resRef, {
          uploadedDocuments: arrayRemove(docItem),
          updatedAt: Date.now()
        });
        setValidDocs(remainingDocs);
        onDocumentsChange?.(remainingDocs);
      }
    } catch (err) {
      console.error("Failed to delete document from database:", err);
      if (!isLocalOnly) {
        handleFirestoreError(err, OperationType.UPDATE, `reservations/${reservationId}`);
      }
    } finally {
      setIsDeletingUrl(null);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (viewOnly) return;
    // Check if user is authenticated in Firebase
    if (!auth.currentUser) {
      setAuthError("You must be signed in to upload documents. Please log in and try again.");
      return;
    }
    setAuthError(null);

    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);

    for (const uFile of newFiles) {
      try {
        let fileToUpload = uFile.file;

        const storagePath = `reservation_documents/${reservationId}/${Date.now()}_${uFile.file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadingFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, progress } : f));
          },
          (error) => {
            console.error("Upload error:", error);
            setUploadingFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'error', error: error.message } : f));
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            const newDoc = {
              url: downloadURL,
              name: uFile.file.name,
              uploadedAt: Date.now(),
              type: uFile.file.type || 'application/octet-stream'
            };

            // Sync with Firestore or local state
            try {
              if (isLocalOnly) {
                setValidDocs(prev => {
                  const updatedDocs = [...prev, newDoc];
                  setTimeout(() => {
                    onDocumentsChange?.(updatedDocs);
                  }, 0);
                  return updatedDocs;
                });
              } else {
                const resRef = doc(db, 'reservations', reservationId);
                await updateDoc(resRef, {
                  uploadedDocuments: arrayUnion(newDoc),
                  updatedAt: Date.now()
                });
                setValidDocs(prev => {
                  const updatedDocs = [...prev, newDoc];
                  setTimeout(() => {
                    onDocumentsChange?.(updatedDocs);
                  }, 0);
                  return updatedDocs;
                });
              }

              setUploadingFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'completed', progress: 100 } : f));
              
              // Clear completed after 3 seconds
              setTimeout(() => {
                setUploadingFiles(prev => prev.filter(f => f.id !== uFile.id));
              }, 3000);

            } catch (err) {
              console.error("Firestore sync error:", err);
              if (!isLocalOnly) {
                handleFirestoreError(err, OperationType.UPDATE, `reservations/${reservationId}`);
              } else {
                setUploadingFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'error', error: 'Failed to save doc' } : f));
              }
            }
          }
        );

      } catch (err) {
        console.error("Compression error:", err);
        setUploadingFiles(prev => prev.map(f => f.id === uFile.id ? { ...f, status: 'error', error: 'Compression failed' } : f));
      }
    }
  }, [reservationId, viewOnly, isLocalOnly, onDocumentsChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    }
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full md:w-[500px] z-[1000] shadow-2xl flex flex-col",
              isDarkMode ? "bg-[#1F1B19]/90 border-l border-white/10" : "bg-white/90 border-l border-black/5",
              "backdrop-blur-xl"
            )}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className={cn("text-xl font-black tracking-tight", isDarkMode ? "text-white" : "text-[#0E0C0B]")}>
                  Reservation Documents
                </h2>
                <p className="text-[10px] font-bold text-[#FF5C35] tracking-[0.2em] uppercase">
                  ID: {reservationId}
                </p>
              </div>
              <button 
                onClick={onClose}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90",
                  isDarkMode ? "bg-white/5 text-white hover:bg-white/10" : "bg-black/5 text-black hover:bg-black/10"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              
              {/* Upload Zone */}
              {!viewOnly && (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
                    isDragActive 
                      ? "border-[#FF5C35] bg-[#FF5C35]/10 scale-[0.99]" 
                      : "border-gray-400/20 hover:border-[#FF5C35]/40 hover:bg-[#FF5C35]/5",
                    isDarkMode ? "bg-black/20" : "bg-gray-50",
                    "p-10 flex flex-col items-center justify-center text-center"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500",
                    isDragActive ? "bg-[#FF5C35] text-white scale-110" : "bg-black/5 text-gray-400 group-hover:scale-110"
                  )}>
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className={cn("text-sm font-black uppercase tracking-widest mb-1", isDarkMode ? "text-white" : "text-black")}>
                    {isDragActive ? "Drop files here" : "Drag & drop files"}
                  </h3>

                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold"
                    >
                      {authError}
                    </motion.div>
                  )}

                  {/* Animated progress if any */}
                  {uploadingFiles.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <motion.div 
                        className="h-full bg-[#FF5C35]" 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadingFiles.reduce((acc, f) => acc + f.progress, 0) / uploadingFiles.length}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Uploading Files Status List */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Active Uploads</p>
                  {uploadingFiles.map(file => (
                    <div key={file.id} className={cn(
                      "p-3 rounded-2xl border flex items-center gap-3",
                      isDarkMode ? "bg-white/5 border-white/5" : "bg-gray-50 border-black/5"
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-[#FF5C35]/10 flex items-center justify-center text-[#FF5C35]">
                        {file.status === 'uploading' ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[11px] font-black truncate", isDarkMode ? "text-white" : "text-black")}>{file.file.name}</p>
                        <div className="w-full bg-black/10 rounded-full h-1 mt-1">
                          <motion.div 
                            className="bg-[#FF5C35] h-full rounded-full" 
                            initial={{ width: 0 }}
                            animate={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-[#FF5C35]">{Math.round(file.progress)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Documents List */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stored Documents</p>
                
                {isValidating && validDocs.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FF5C35] mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verifying documents...</p>
                  </div>
                ) : validDocs.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center opacity-20 text-center">
                    <FileText className="w-16 h-16 mb-4 text-[#FF5C35]" />
                    <p className="text-sm font-black uppercase tracking-tighter text-[#FF5C35]">NO DOCUMENTS UPLOADED YET</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {validDocs.sort((a, b) => b.uploadedAt - a.uploadedAt).map((docItem, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "group p-4 rounded-3xl border transition-all duration-300 hover:scale-[1.01]",
                          isDarkMode 
                            ? "bg-[#2C2724] border-white/5 hover:border-[#FF5C35]/30" 
                            : "bg-white border-black/5 hover:border-[#FF5C35]/30 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                            docItem.type.includes('image') ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {docItem.type.includes('image') ? <FileImage className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className={cn("text-xs font-black truncate", isDarkMode ? "text-white" : "text-black")}>
                              {docItem.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">
                                {format(docItem.uploadedAt, 'dd MMM yyyy, HH:mm')}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-gray-400" />
                              <span className="text-[9px] font-black text-[#FF5C35] uppercase">
                                {docItem.type.split('/')[1]?.toUpperCase()}
                              </span>
                            </div>
                          </div>
 
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a 
                              href={docItem.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90",
                                isDarkMode ? "bg-white/5 text-white hover:bg-[#FF5C35]" : "bg-black/5 text-black hover:bg-[#FF5C35] hover:text-white"
                              )}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            {!viewOnly && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(docItem)}
                                disabled={isDeletingUrl === docItem.url}
                                className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90",
                                  isDarkMode 
                                    ? "bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-500" 
                                    : "bg-black/5 text-red-500 hover:bg-red-50 hover:text-red-650"
                                )}
                                title="Delete"
                              >
                                {isDeletingUrl === docItem.url ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-[#FF5C35]" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Enterprise Document Security Enabled
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
