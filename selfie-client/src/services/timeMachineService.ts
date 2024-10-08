import {install, InstalledClock} from '@sinonjs/fake-timers';
import axios from 'axios';
import {useDateStore} from "@/stores/dateStore";

const API_URL = process.env.VUE_APP_API_URL + '/timeMachine';

let clock: InstalledClock | undefined; // the global clock

const setGlobalClock = async (date: Date) => {    
    try {
        const response = await axios.post(`${API_URL}/setGlobalClock`, {date}, {withCredentials: true});
        setLocalGlobalClock(date);
    } catch (error: any) {
        throw new Error(error.response.data);
    }
}

const setLocalGlobalClock = (date: Date) => {
    if (clock)
        clock.uninstall();

    const realDate = new Date();
    clock = install({now: date, shouldAdvanceTime: true, shouldClearNativeTimers: true});
    useDateStore().setRealTimeDiff(date.getTime() - realDate.getTime());
}

const restoreGlobalClock = async () => {
    try {
        const response = await axios.post(`${API_URL}/restoreGlobalClock`, {}, {withCredentials: true});
        
        if (clock) {
            clock.uninstall();
            clock = undefined;
        }
    } catch (error: any) {
        throw new Error(error.response.data);
    }
}

const getTimeOfServer = async () => {
    try {
        const response = await axios.get(`${API_URL}`, {withCredentials: true});
        return new Date(response.data.time);
    } catch (error: any) {
        return new Date();
    }
}

export default {
    setGlobalClock,
    setLocalGlobalClock,
    restoreGlobalClock,
    getTimeOfServer
}