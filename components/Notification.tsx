
import React, { useEffect } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, CloseIcon } from './icons';

interface NotificationProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    const isSuccess = type === 'success';
    const bgColor = isSuccess ? 'bg-green-100 dark:bg-green-900/95' : 'bg-red-100 dark:bg-red-900/95';
    const textColor = isSuccess ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200';
    const Icon = isSuccess ? CheckCircleIcon : ExclamationCircleIcon;
    const ringColor = isSuccess ? 'focus:ring-green-600' : 'focus:ring-red-600';
    const ringOffsetColor = isSuccess ? 'dark:focus:ring-offset-green-900' : 'dark:focus:ring-offset-red-900';

    return (
        <div className={`fixed top-5 right-5 z-50 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${bgColor}`}>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <Icon className={`h-6 w-6 ${textColor}`} aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className={`text-sm font-medium ${textColor}`}>
                            {message}
                        </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button
                            onClick={onClose}
                            className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${textColor} hover:bg-black/10 ${ringColor} ${ringOffsetColor}`}
                        >
                            <span className="sr-only">Close</span>
                            <CloseIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notification;
