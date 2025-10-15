// src/lib/utils/customer-helpers.js

/**
 * Calculate customer lifetime value (CLV) from customer data
 * @param {Object} customer - Customer object with totalValue
 * @returns {number} Total revenue from customer
 */
export function calculateCustomerValue(customer) {
  return customer?.totalValue || 0;
}

/**
 * Get customer engagement score (0-100)
 * @param {Array} activities - Customer activities
 * @returns {number} Engagement score
 */
export function calculateEngagementScore(activities) {
  if (!activities || activities.length === 0) return 0;

  let score = 0;

  activities.forEach(activity => {
    const icon = activity.icon || '';
    const text = (activity.text || '').toLowerCase();

    // Email sent: 5 points
    if (icon === '📧' || icon === '📤') score += 5;
    
    // Email opened: 15 points
    if (icon === '📬' || text.includes('opened')) score += 15;
    
    // Link clicked: 20 points
    if (icon === '🖱️' || text.includes('clicked')) score += 20;
    
    // Email replied: 30 points
    if (icon === '💬' || text.includes('replied')) score += 30;
    
    // Meeting booked: 40 points
    if (icon === '📅' || text.includes('meeting') || text.includes('booked')) score += 40;
    
    // Purchase: 50 points
    if (icon === '💰' || text.includes('purchased')) score += 50;
  });

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Determine lead temperature (cold, warm, hot)
 * @param {Object} customer - Customer object
 * @returns {string} Lead temperature
 */
export function getLeadTemperature(customer) {
  const engagementScore = calculateEngagementScore(customer.activities || []);
  
  if (customer.status === 'Converted') return 'hot';
  if (engagementScore >= 50) return 'hot';
  if (engagementScore >= 25) return 'warm';
  return 'cold';
}

/**
 * Get suggested next action for customer
 * @param {Object} customer - Customer object
 * @returns {string} Suggested action
 */
export function getSuggestedNextAction(customer) {
  const activities = customer.activities || [];
  const status = customer.status;

  if (status === 'Converted') {
    return 'Send thank you email';
  }

  const hasReplied = activities.some(a => a.icon === '💬' || (a.text || '').toLowerCase().includes('replied'));
  const hasOpened = activities.some(a => a.icon === '📬' || (a.text || '').toLowerCase().includes('opened'));
  const hasClicked = activities.some(a => a.icon === '🖱️' || (a.text || '').toLowerCase().includes('clicked'));

  if (hasReplied) {
    return 'Schedule a call';
  }

  if (hasClicked) {
    return 'Send follow-up email';
  }

  if (hasOpened && !hasClicked) {
    return 'Send value proposition';
  }

  if (!hasOpened && activities.length > 0) {
    return 'Try different subject line';
  }

  return 'Send initial outreach';
}

/**
 * Export customers to CSV
 * @param {Array} customers - Array of customer objects
 * @returns {string} CSV string
 */
export function exportToCSV(customers) {
  const headers = ['Name', 'Email', 'Company', 'Status', 'Last Activity', 'Total Activities', 'Engagement Score'];
  
  const rows = customers.map(customer => [
    customer.name || 'Unknown',
    customer.email || 'No email',
    customer.company || 'N/A',
    customer.status || 'Unknown',
    customer.lastContacted ? new Date(customer.lastContacted).toLocaleDateString() : 'Never',
    (customer.activities || []).length.toString(),
    calculateEngagementScore(customer.activities || []).toString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename for download
 */
export function downloadCSV(csvContent, filename = 'customers.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

