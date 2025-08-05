// src/components/ai-activity/ActivityDetailModal.js
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentTextIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';

export default function ActivityDetailModal({ activity, isOpen, onClose }) {
  if (!activity) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return format(parseISO(timestamp), 'PPpp');
    } catch (error) {
      return timestamp;
    }
  };

  const getActivityTypeInfo = () => {
    const type = activity.metadata?.type || activity.type || '';
    
    if (type.includes('email_sent')) {
      return {
        title: 'Email Sent',
        color: 'text-blue-600 bg-blue-50',
        details: [
          { label: 'Recipient', value: activity.metadata?.recipientEmail },
          { label: 'Company', value: activity.metadata?.recipientCompany },
          { label: 'Subject', value: activity.metadata?.subject },
          { label: 'Campaign ID', value: activity.metadata?.campaignId }
        ]
      };
    }
    
    if (type.includes('email_opened')) {
      return {
        title: 'Email Opened',
        color: 'text-green-600 bg-green-50',
        details: [
          { label: 'Recipient', value: activity.metadata?.recipientEmail },
          { label: 'Open Time', value: formatDate(activity.metadata?.openTime) },
          { label: 'Device', value: activity.metadata?.userAgent || 'Unknown' }
        ]
      };
    }
    
    if (type.includes('email_replied')) {
      return {
        title: 'Email Reply Received',
        color: 'text-purple-600 bg-purple-50',
        details: [
          { label: 'From', value: activity.metadata?.recipientEmail },
          { label: 'Sentiment', value: activity.metadata?.sentiment || 'Neutral' },
          { label: 'Response Preview', value: activity.metadata?.replyText?.substring(0, 100) + '...' }
        ]
      };
    }
    
    if (type.includes('meeting_booked')) {
      return {
        title: 'Meeting Scheduled',
        color: 'text-yellow-600 bg-yellow-50',
        details: [
          { label: 'Attendee', value: activity.metadata?.attendeeName },
          { label: 'Email', value: activity.metadata?.attendeeEmail },
          { label: 'Scheduled Time', value: formatDate(activity.metadata?.scheduledTime) },
          { label: 'Duration', value: activity.metadata?.duration }
        ]
      };
    }
    
    if (type.includes('prospect_search')) {
      return {
        title: 'Prospect Discovery',
        color: 'text-indigo-600 bg-indigo-50',
        details: [
          { label: 'Industry', value: activity.metadata?.industry },
          { label: 'Prospects Found', value: activity.metadata?.count },
          { label: 'Search Terms', value: activity.metadata?.searchTerms },
          { label: 'Source', value: activity.metadata?.source }
        ]
      };
    }
    
    if (type.includes('optimization')) {
      return {
        title: 'Campaign Optimization',
        color: 'text-orange-600 bg-orange-50',
        details: [
          { label: 'Type', value: activity.metadata?.type },
          { label: 'Previous Value', value: activity.metadata?.oldValue },
          { label: 'New Value', value: activity.metadata?.newValue },
          { label: 'Expected Improvement', value: activity.metadata?.expectedImprovement }
        ]
      };
    }
    
    return {
      title: 'Activity Details',
      color: 'text-gray-600 bg-gray-50',
      details: []
    };
  };

  const typeInfo = getActivityTypeInfo();

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10">
                    <span className="text-2xl">{activity.icon}</span>
                  </div>
                  
                  <div className="mt-3 flex-1 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      {typeInfo.title}
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">{activity.text}</p>
                      {activity.details && (
                        <p className="mt-1 text-sm text-gray-600">{activity.details}</p>
                      )}
                    </div>
                    
                    {/* Activity Type Badge */}
                    <div className="mt-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${typeInfo.color}`}>
                        {activity.type}
                      </span>
                    </div>
                    
                    {/* Detailed Information */}
                    <div className="mt-4 space-y-3">
                      {typeInfo.details.map((detail, index) => detail.value && (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-500">{detail.label}:</span>
                          <span className="text-gray-900 font-medium ml-2 text-right">{detail.value}</span>
                        </div>
                      ))}
                      
                      <div className="flex justify-between text-sm pt-3 border-t border-gray-200">
                        <span className="text-gray-500">Timestamp:</span>
                        <span className="text-gray-900 font-medium">{formatDate(activity.created_at)}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        className="flex-1 inline-flex justify-center items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        onClick={() => {
                          // TODO: Implement view full details functionality
                          console.log('View full details:', activity);
                        }}
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-1" />
                        View Full Details
                      </button>
                      
                      <button
                        type="button"
                        className="flex-1 inline-flex justify-center items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        onClick={() => {
                          // TODO: Implement analytics functionality
                          console.log('View analytics:', activity);
                        }}
                      >
                        <ChartBarIcon className="h-4 w-4 mr-1" />
                        Analytics
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}