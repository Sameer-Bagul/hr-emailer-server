class DateUtils {
  static getCurrentTimestamp() {
    return new Date().toISOString();
  }

  static formatDate(date, format = 'localeString') {
    const dateObj = new Date(date);
    
    switch (format) {
      case 'localeString':
        return dateObj.toLocaleString();
      case 'localeDateString':
        return dateObj.toLocaleDateString();
      case 'localeTimeString':
        return dateObj.toLocaleTimeString();
      case 'iso':
        return dateObj.toISOString();
      case 'dateString':
        return dateObj.toDateString();
      default:
        return dateObj.toString();
    }
  }

  static calculateDuration(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end - start;
      
      if (isNaN(durationMs)) {
        return { days: 1, hours: 0, minutes: 0, seconds: 0 };
      }
      
      const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor(durationMs / (1000 * 60));
      const seconds = Math.floor(durationMs / 1000);
      
      return {
        days: Math.max(1, days), // Minimum 1 day
        hours,
        minutes,
        seconds,
        totalMs: durationMs
      };
    } catch (error) {
      return { days: 1, hours: 0, minutes: 0, seconds: 0 };
    }
  }

  static addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static isToday(date) {
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.toDateString() === today.toDateString();
  }

  static isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
  }

  static getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  static generateTimestamp() {
    return Date.now();
  }

  static generateId(prefix = '') {
    const timestamp = this.generateTimestamp();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}${timestamp}_${random}`;
  }
}

module.exports = DateUtils;
