// src/components/ai-activity/ActivityTimeline.js
import { forwardRef, useState, useEffect } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  FunnelIcon, 
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const ActivityTimeline = forwardRef(({ activities, onActivityClick }, ref) => {
  const [filteredActivities, setFilteredActivities] = useState(activities);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  useEffect(() => {
    filterActivities();
  }, [activities, searchTerm, filterType]);

  const filterActivities = () => {
    let filtered = [...activities];
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(activity => {
        const activityType = activity.metadata?.type || activity.type || '';
        return activityType.includes(filterType);
      });
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(activity => {
        const searchLower = searchTerm.toLowerCase();
        return (
          activity.text?.toLowerCase().includes(searchLower) ||
          activity.details?.toLowerCase().includes(searchLower) ||
          activity.metadata?.recipientEmail?.toLowerCase().includes(searchLower) ||
          activity.metadata?.company?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    setFilteredActivities(filtered);
  };

  const formatActivityTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = parseISO(timestamp);
      
      if (isToday(date)) {
        return format(date, "'Today at' h:mm a");
      } else if (isYesterday(date)) {
        return format(date, "'Yesterday at' h:mm a");
      } else {
        return format(date, "MMM d 'at' h:mm a");
      }
    } catch (error) {
      return timestamp;
    }
  };

  const getActivityTypeColor = (activity) => {
    const type = activity.metadata?.type || activity.type || '';
    
    if (type.includes('email_sent')) return 'bg-blue-100 text-blue-800';
    if (type.includes('email_opened')) return 'bg-green-100 text-green-800';
    if (type.includes('email_replied')) return 'bg-purple-100 text-purple-800';
    if (type.includes('meeting_booked')) return 'bg-yellow-100 text-yellow-800';
    if (type.includes('prospect_search')) return 'bg-indigo-100 text-indigo-800';
    if (type.includes('optimization')) return 'bg-orange-100 text-orange-800';
    
    return 'bg-gray-100 text-gray-800';
  };

  const activityTypes = [
    { value: 'all', label: 'All Activities' },
    { value: 'email', label: 'Emails' },
    { value: 'prospect', label: 'Prospects' },
    { value: 'meeting', label: 'Meetings' },
    { value: 'optimization', label: 'Optimizations' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" ref={ref}>
      {/* Header with Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <h2 className="text-lg font-semibold text-gray-900 flex-shrink-0">
            Activity Timeline
          </h2>
          
          <div className="flex flex-1 gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {activityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <FunnelIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
        
        {/* Activity Count */}
        <p className="text-sm text-gray-500 mt-2">
          Showing {filteredActivities.length} of {activities.length} activities
        </p>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No activities found</p>
          </div>
        ) : (
          filteredActivities.map((activity, index) => (
            <div
              key={activity.id || index}
              onClick={() => onActivityClick(activity)}
              className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150 group"
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className="flex-shrink-0 text-2xl">
                  {activity.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.text}
                      </p>
                      {activity.details && (
                        <p className="text-sm text-gray-500 mt-1">
                          {activity.details}
                        </p>
                      )}
                      
                      {/* Tags */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActivityTypeColor(activity)}`}>
                          {activity.type}
                        </span>
                        
                        {activity.metadata?.recipientEmail && (
                          <span className="text-xs text-gray-500">
                            {activity.metadata.recipientEmail}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Arrow Icon */}
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 ml-2" />
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex items-center mt-2 text-xs text-gray-400">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    {activity.time || formatActivityTime(activity.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Load More - Future Enhancement */}
      {filteredActivities.length >= 20 && (
        <div className="p-4 border-t border-gray-100">
          <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            Load more activities
          </button>
        </div>
      )}
    </div>
  );
});

ActivityTimeline.displayName = 'ActivityTimeline';

export default ActivityTimeline;