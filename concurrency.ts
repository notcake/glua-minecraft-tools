export type Thread<T> = () => Promise<T>;

export interface IQueuedThread<T> {
    thread: Thread<T>;
    entryOK: (val: T) => void;
    entryFail: (err?: string) => void;
    promise?: Promise<T>;
}

export class ConcurrentManager {
    queuedThreads: IQueuedThread<any>[] = [];
    activeThreads: IQueuedThread<any>[] = [];

    tickCallbacks: Function[] = [];
    
    constructor(public maxThreads = 10) {

    }

    tickQueue() {
        let openSlots = Math.max(0,this.maxThreads - this.activeThreads.length);

        for(let i=0;i < openSlots;i++) {
            if(this.queuedThreads.length > 0) {
                this.startThread(this.queuedThreads.splice(0,1)[0]);
            }
            else {
                break;
            }
        }

        for(let cb of this.tickCallbacks) {
            cb();
        }
    }

    startThread(queued: IQueuedThread<any>) {
        if(this.activeThreads.length < this.maxThreads) {
            const idx = this.queuedThreads.indexOf(queued);
            if(idx !== -1) {
                this.queuedThreads.splice(idx,1);
            }
            this.activeThreads.push(queued);

            queued.thread().then((val) => {
                queued.entryOK(val);
                this.closeThread(queued);
            }).catch((e) => {
                queued.entryFail(e);
                this.closeThread(queued);
                throw e;
            })
        }
    }

    closeThread(queued: IQueuedThread<any>) {
        const idx = this.activeThreads.indexOf(queued);
        if(idx !== -1) {
            this.activeThreads.splice(idx,1);
        }
        this.tickQueue();
    }

    queueThread<T>(thread: Thread<T>) {
        return new Promise<T>((res,rej) => {
            this.queuedThreads.push({
                thread,
                entryOK: res,
                entryFail: rej,
            });
            this.tickQueue();
        });
    }

    defer() {
        return new Promise((res) => {
            // wait for all threads to complete
            let cb = () => {
                if(this.queuedThreads.length === 0) {
                    if(this.activeThreads.length === 0) {
                        let idx = this.tickCallbacks.indexOf(cb);
                        if(idx !== -1) {
                            this.tickCallbacks.splice(idx,1);
                        }

                        res();
                    }
                }
            }

            this.tickCallbacks.push(cb)
        })
    }
}
