import React, { useState, useRef } from 'react';
import { Kpi } from '../types';
import Modal from './Modal';
import { TrashIcon, UploadIcon, PaperclipIcon, ClipboardDocumentListIcon, InfoCircleIcon } from './icons';

interface EvidenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpi: Kpi;
    onSave: (kpiId: string, newEvidence: Kpi['kanit_dosyalari']) => void;
}

const EvidenceModal: React.FC<EvidenceModalProps> = ({ isOpen, onClose, kpi, onSave }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [newLink, setNewLink] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true);
        const newFiles: Kpi['kanit_dosyalari'] = [...kpi.kanit_dosyalari];

        // FIX: Explicitly type `file` as `File` to fix type inference issues in some environments.
        const fileReadPromises = Array.from(files).map((file: File) => {
            return new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(',')[1];
                    newFiles.push({
                        id: `file-${Date.now()}-${Math.random()}`,
                        name: file.name,
                        type: file.type,
                        data: base64Data,
                    });
                    resolve();
                };
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        });

        try {
            await Promise.all(fileReadPromises);
            onSave(kpi.id, newFiles);
        } catch (error) {
            console.error("Dosya okuma hatası:", error);
            alert("Bir veya daha fazla dosya okunurken hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddLink = () => {
        if (!newLink.trim()) return;
        try {
            new URL(newLink); // Validate URL
            const newEvidence = [...kpi.kanit_dosyalari, {
                id: `link-${Date.now()}`,
                name: newLink,
                type: 'link',
                data: newLink,
            }];
            onSave(kpi.id, newEvidence);
            setNewLink('');
        } catch (_) {
            alert('Lütfen geçerli bir URL girin.');
        }
    };

    const handleDelete = (fileId: string) => {
        const newEvidence = kpi.kanit_dosyalari.filter(f => f.id !== fileId);
        onSave(kpi.id, newEvidence);
    };
    
    // Helper function for standard browser handling (display or download)
    const openFileNatively = (file: Kpi['kanit_dosyalari'][0]) => {
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: file.type });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank');
        // Revoke the object URL after a short delay to prevent memory leaks,
        // giving the new tab time to load the content.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    };

    const handleOpenFile = (file: Kpi['kanit_dosyalari'][0]) => {
        if (file.type === 'link') {
            window.open(file.data, '_blank', 'noopener,noreferrer');
            return;
        }
        
        // For all other file types, including Excel, just open/download them natively.
        // The preview feature was removed as per user feedback to prefer the original file.
        openFileNatively(file);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Kanıt Dosyaları: ${kpi.kpi_adi}`} size="2xl">
            <div className="space-y-4">
                <div className="p-4 border dark:border-gray-600 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Yeni Link Ekle</h3>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={newLink}
                            onChange={(e) => setNewLink(e.target.value)}
                            placeholder="https://..."
                            className="flex-grow form-input"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                        />
                        <button onClick={handleAddLink} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Ekle</button>
                    </div>
                </div>
                
                <div className="p-4 border dark:border-gray-600 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Veya Yeni Dosya Yükle</h3>
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span>Yükleniyor...</span>
                        ) : (
                            <>
                                <UploadIcon className="w-4 h-4" /> Dosya Seç
                            </>
                        )}
                    </button>
                </div>
                
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                    {kpi.kanit_dosyalari.length === 0 ? (
                        <p className="text-center text-gray-500 italic py-4">Henüz kanıt dosyası eklenmemiş.</p>
                    ) : (
                        kpi.kanit_dosyalari.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                <div className="flex items-center gap-3 min-w-0">
                                    {file.type === 'link' ? <PaperclipIcon className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ClipboardDocumentListIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                                    <button onClick={() => handleOpenFile(file)} className="text-sm font-medium truncate hover:underline text-blue-600 dark:text-blue-400 text-left" title={file.name}>
                                        {file.name}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleDelete(file.id)} className="p-1 text-red-500 hover:text-red-700 flex-shrink-0">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 p-3 flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                    <InfoCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                    <div>
                        <h4 className="font-semibold">İndirilen Dosyalar Nerede?</h4>
                        <p className="mt-1 text-xs">
                            Tarayıcı güvenlik kuralları nedeniyle dosyalar doğrudan açılamaz. Bir dosyayı ismine tıklayarak indirdikten sonra, tarayıcınızın <strong>"İndirilenler"</strong> bölümünden (genellikle <kbd className="px-1.5 py-0.5 text-xs font-sans font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded-md">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 text-xs font-sans font-semibold text-gray-800 bg-gray-200 border border-gray-300 rounded-md">J</kbd> tuşları ile açılır) dosyanın konumunu bulabilirsiniz.
                        </p>
                    </div>
                </div>

            </div>

            <div className="pt-5 text-right">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">
                    Kapat
                </button>
            </div>
        </Modal>
    );
};

export default EvidenceModal;