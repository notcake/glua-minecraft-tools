export class SemanticVersion {
    constructor(public major, public minor, public patch) {

    }

    toString() {
        return `${this.major}.${this.minor}.${this.patch}`;
    }

    static fromString(ver: string | null, decimalPatch = false) {
        let major = 0;
        let minor = 0;
        let patch = 0;
    
        if (ver) {
            let extracted = decimalPatch ? ver.trim().match(/^(\d+)\.(\d+)\.(\d+\.\d+)$/) : ver.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
    
            if (extracted) {
                if (extracted[1]) {
                    major = parseInt(extracted[1]);
                }
                
                if (extracted[2]) {
                    minor = parseInt(extracted[2]);
                }
                
                if (extracted[3]) {
                    if (decimalPatch) {
                        patch = parseFloat(extracted[3]);
                    }
                    else {
                        patch = parseInt(extracted[3]);
                    }
                }
            }
        }
    
        return new SemanticVersion(major, minor, patch);
    }

    isEqual(rhs: SemanticVersion,options: {ignoreMinor?: boolean, ignorePatch?: boolean} = {}) {
        if(this.major !== rhs.major) {
            return false;
        }

        if(!options.ignoreMinor) {
            if(this.minor !== rhs.minor) {
                return false;
            }
        }

        if(!options.ignorePatch) {
            if(this.patch !== rhs.patch) {
                return false;
            }
        }

        return true;
    }

    isAhead(rhs: SemanticVersion,options: {ignoreMinor?: boolean, ignorePatch?: boolean} = {}) {
        if(this.major > rhs.major) {
            return true;
        }

        if(!options.ignoreMinor) {
            if(this.minor > rhs.minor) {
                return true;
            }
        }

        if(!options.ignorePatch) {
            if(this.patch > rhs.patch) {
                return true;
            }
        }

        return false;
    }

    isBehind(rhs: SemanticVersion,options: {ignoreMinor?: boolean, ignorePatch?: boolean} = {}) {
        // viva la code reuse
        return !this.isEqual(rhs, options) && !this.isBehind(rhs, options);
    }
}
