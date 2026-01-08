
export interface Applicant {
    workerId: string;
    workerName: string;
    skills: string[];
    appliedAt: string;
    confirmedAt?: string;
    attendanceStatus: 'postulado' | 'confirmado' | 'asistio' | 'no_asistio';
    attendanceMarkedAt?: string;
  }
  
  const STORAGE_KEY = 'agroconnect_v2_applicants';
  const DAILY_ATTENDANCE_KEY = 'agroconnect_v2_daily_attendance';
  const CLOSED_DAYS_KEY = 'agroconnect_v2_closed_days';
  
  interface StoreSchema {
    [jobId: string]: Applicant[];
  }
  
  interface DailyAttendanceSchema {
    [jobId: string]: {
      [date: string]: {
        [workerId: string]: 'absent' | 'present';
      };
    };
  }
  
  interface ClosedDaysSchema {
    [jobId: string]: {
      [date: string]: boolean;
    };
  }
  
  const getStore = (): StoreSchema => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("AgroConnect Store corrupted, resetting.", e);
      return {};
    }
  };
  
  const saveStore = (store: StoreSchema) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  };
  
  const getDailyAttendanceStore = (): DailyAttendanceSchema => {
    try {
      const data = localStorage.getItem(DAILY_ATTENDANCE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  };
  
  const saveDailyAttendanceStore = (store: DailyAttendanceSchema) => {
    localStorage.setItem(DAILY_ATTENDANCE_KEY, JSON.stringify(store));
  };
  
  const getClosedDaysStore = (): ClosedDaysSchema => {
    try {
      const data = localStorage.getItem(CLOSED_DAYS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  };
  
  const saveClosedDaysStore = (store: ClosedDaysSchema) => {
    localStorage.setItem(CLOSED_DAYS_KEY, JSON.stringify(store));
  };
  
  export const applicantStore = {
    addApplicant: (jobId: string, applicant: Omit<Applicant, 'attendanceStatus'>) => {
      const store = getStore();
      if (!store[jobId]) store[jobId] = [];
      if (store[jobId].some(a => a.workerId === applicant.workerId)) return;
      store[jobId].push({ ...applicant, attendanceStatus: 'postulado' });
      saveStore(store);
    },
  
    markConfirmed: (jobId: string, workerId: string, confirmedAt: string) => {
      const store = getStore();
      if (!store[jobId]) return;
      store[jobId] = store[jobId].map(a => 
        a.workerId === workerId ? { ...a, attendanceStatus: 'confirmado', confirmedAt } : a
      );
      saveStore(store);
    },
  
    markNoShow: (jobId: string, workerId: string, timestamp: string) => {
      const store = getStore();
      if (!store[jobId]) return;
      store[jobId] = store[jobId].map(a => 
        a.workerId === workerId ? { ...a, attendanceStatus: 'no_asistio', attendanceMarkedAt: timestamp } : a
      );
      saveStore(store);
    },
  
    markAttendance: (jobId: string, workerId: string, status: 'asistio' | 'no_asistio') => {
      const store = getStore();
      if (!store[jobId]) return;
      store[jobId] = store[jobId].map(a => 
        a.workerId === workerId ? { ...a, attendanceStatus: status, attendanceMarkedAt: new Date().toISOString() } : a
      );
      saveStore(store);
    },
  
    getApplicants: (jobId: string): Applicant[] => {
      return getStore()[jobId] || [];
    },
  
    getAllWorkerApplications: (workerId: string): (Applicant & { jobId: string })[] => {
      const store = getStore();
      const result: (Applicant & { jobId: string })[] = [];
      Object.keys(store).forEach(jobId => {
        const found = store[jobId].find(a => a.workerId === workerId);
        if (found) result.push({ ...found, jobId });
      });
      return result;
    },
  
    closeShift: (jobId: string, timestamp: string) => {
      const store = getStore();
      if (!store[jobId]) return;
      store[jobId] = store[jobId].map(a => 
        (a.attendanceStatus === 'postulado' || a.attendanceStatus === 'confirmado')
          ? { ...a, attendanceStatus: 'no_asistio', attendanceMarkedAt: timestamp }
          : a
      );
      saveStore(store);
    },
  
    // --- Daily Attendance Functions ---
    
    markDailyAbsent: (jobId: string, date: string, workerId: string, isAbsent: boolean) => {
      const store = getDailyAttendanceStore();
      if (!store[jobId]) store[jobId] = {};
      if (!store[jobId][date]) store[jobId][date] = {};
      
      if (isAbsent) {
        store[jobId][date][workerId] = 'absent';
      } else {
        delete store[jobId][date][workerId];
      }
      saveDailyAttendanceStore(store);
    },
  
    getDailyAttendance: (jobId: string, date: string) => {
      const store = getDailyAttendanceStore();
      return store[jobId]?.[date] || {};
    },
  
    closeDailyAttendance: (jobId: string, date: string) => {
      const store = getClosedDaysStore();
      if (!store[jobId]) store[jobId] = {};
      store[jobId][date] = true;
      saveClosedDaysStore(store);
    },
  
    isDailyAttendanceClosed: (jobId: string, date: string): boolean => {
      const store = getClosedDaysStore();
      return !!store[jobId]?.[date];
    }
  };
  