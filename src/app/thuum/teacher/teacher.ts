import { Thuum } from '../thuum';
import { Teacher } from '../thuum.types';

import './teacher.scss';

export function TeacherComponent(thuum: Thuum, teacher: Teacher, game: Game) {
    return {
        $template: '#thuum-teacher',
        teacher,
        teacherName: teacher.name,
        media: teacher.media,
        id: teacher.id,
        localId: teacher.localID.toLowerCase(),
        minGP: 0,
        maxGP: 0,
        displayMinGP: 0,
        displayMaxGP: 0,
        disabled: false,
        progressBar: {} as ProgressBarElement,
        mounted: function () {
            const grantsContainer = document
                .querySelector(`#${this.localId}`)
                .querySelector('#grants-container') as HTMLElement;

            this.xpIcon = grantsContainer.querySelector('#thuum-xp');
            this.masteryIcon = grantsContainer.querySelector('#thuum-mastery-xp');
            this.masteryPoolIcon = grantsContainer.querySelector('#thuum-pool-xp');
            this.intervalIcon = grantsContainer.querySelector('#thuum-interval');

            this.progressBar = document
                .querySelector(`#${this.localId}`)
                .querySelector<ProgressBarElement>('progress-bar');
        },
        updateGrants: function (
            xp: number,
            baseXP: number,
            masteryXP: number,
            baseMasteryXP: number,
            masteryPoolXP: number,
            interval: number,
            realm: Realm
        ) {
            try {
                this.xpIcon.setXP(xp, baseXP);
                this.xpIcon.setSources(game.thuum.getXPSources(teacher));
                this.masteryIcon.setXP(masteryXP, baseMasteryXP);
                this.masteryIcon.setSources(game.thuum.getMasteryXPSources(teacher));
                this.masteryPoolIcon.setXP(masteryPoolXP);
                game.unlockedRealms.length > 1 ? this.masteryPoolIcon.setRealm(realm) : this.masteryPoolIcon.hideRealms();
                this.intervalIcon.setInterval(interval, thuum.getIntervalSources(teacher))
            } catch (error) {
                console.error('updateGrants', error)
            }
        },
        goldToTake: function () {
            let minGP = this.getMinGPRoll();
            let maxGP = this.getMaxGPRoll();

            // Roll a value between min and max
            let gpToTake = rollInteger(minGP, maxGP);

            return this.modGP(gpToTake)
        },
        modGP: function (gp: number) {
            let gpToTake = 0;
        
            // Calculate the GP modifier multiplier
            const increasedGPModifier = this.getGPModifier();
            
            let gpMultiplier = increasedGPModifier / 100;
        
            // Apply the multiplier to the rolled GP value
            const flatCurrencyGain = game.modifiers.getValue('melvorD:flatCurrencyGain', game.gp.modQuery);
        
            gpToTake = Math.floor(gpMultiplier * gp + flatCurrencyGain); 
        
            if (!gpToTake || typeof gpToTake !== 'number') {
                gpToTake = 1;
            }
        
            return gpToTake * -1;
        },        
        updateGPRange: function () {
            let minGP = this.getMinGPRoll();
            let maxGP = this.getMaxGPRoll();
            minGP = -this.modGP(minGP); // Negate the result of modGP(minGP)
            maxGP = -this.modGP(maxGP); // Negate the result of modGP(maxGP)
            this.minGP = minGP;
            this.maxGP = maxGP;
            this.displayMinGP = minGP;
            this.displayMaxGP = maxGP;
        },        
        train: function () {
            thuum.train(teacher);
        },
        Master: function () {
            thuum.Master(teacher);
        },
        mastery: function () {
            thuum.unlockMastery(teacher);
        },
        updateDisabled: function () {
            this.disabled = thuum.shouts.isMastered(teacher);
        },
        getSkillIcons: function () {
            return teacher.skills.map(skillId => {
                try {
                    if (!/(jpg|gif|png|JPG|GIF|PNG|JPEG|jpeg|svg)$/.test(skillId)) {
                        return game.skills.find(skill => skill.id === skillId)?.media;
                    } else {
                        return skillId
                    }
                } catch (error) {
                    return "https://cdn2-main.melvor.net/assets/april/images/lemon.jpg"
                }
                // return game.skills.find(skill => skill.id === skillId)?.media;
            });
        },
        getMinGPRoll: function () {
            return Math.max(1, Math.floor(this.getMaxGPRoll() / 100));
        },
        getMaxGPRoll: function () {
            return teacher.maxGP + thuum.getMasteryLevel(teacher);
        },
        getGPModifier: function () {
            let increasedGPModifier = game.thuum.getCurrencyModifier(game.gp);
            increasedGPModifier += game.modifiers.getValue('namespace_thuum:ThuumGP', game.gp.modQuery);
            return increasedGPModifier;
        }
    };
}
