import { ThuumActionEvent } from './event';
import { UserInterface } from './user-interface';
import { MasteryComponent } from './mastery/mastery';
import { ThuumManager } from './manager';
import { MasteredShout, Teacher, ThuumSkillData, UpgradeModifier } from './thuum.types';
import { Decoder } from './decoder/decoder';
import { MasteredShouts } from './mastered-shouts';
import { ChangeType, ThuumSettings } from './settings';

import './thuum.scss';

export class Thuum extends GatheringSkill<Teacher, ThuumSkillData> {
    public readonly version = 0;
    public readonly _media = 'https://cdn.melvor.net/core/v018/assets/media/monsters/dragon_red.png';
    public readonly _events = window.mitt();
    public readonly on = this._events.on;
    public readonly off = this._events.off;
    public readonly renderQueue = new ThuumRenderQueue();
    public activeTeacher: Teacher;
    public shouts = new MasteredShouts(this);
    public userInterface: UserInterface;
    public settings: ThuumSettings;
    public masteriesUnlocked = new Map<Teacher, boolean[]>();
    public changesMade: any;
    private renderedProgressBar?: ProgressBarElement;
    public abyssalMilestones: Teacher[];

    public readonly manager: ThuumManager;
    public upgradeModifiers: UpgradeModifier[] = [];

    constructor(namespace: DataNamespace, public readonly game: Game) {
        super(namespace, 'Thuum', game);
        this.manager = new ThuumManager(this, this.game);
    }

    public registerData(namespace: DataNamespace, data: ThuumSkillData) {
        super.registerData(namespace, data);

        if (data.teachers) {
            for (const teacher of data.teachers) {
                this.actions.registerObject(new Teacher(namespace, teacher, this.game));
            }
        }
        if (data.upgrades) {
            for (const upgrade of data.upgrades) {
                this.upgradeModifiers.push(new UpgradeModifier(upgrade, this.game));
            }
        }
    }

    public get name() {
        return getLangString('Thuum_Thuum_Thuum');
    }

    public get actionLevel() {
        return this.activeTeacher.level;
    }

    public get masteryAction() {
        return this.activeTeacher;
    }

    public get masteryModifiedInterval() {
        return this.actionInterval;
    }

    public get actionInterval() {
        return this.getTeacherInterval(this.activeTeacher);
    }

    public train(teacher: Teacher) {
        const wasActive = this.isActive;

        if (this.isActive && !this.stop()) {
            return;
        }

        if (!wasActive || teacher !== this.activeTeacher) {
            this.activeTeacher = teacher;
            this.start();
        }
    }

    public Master(teacher: Teacher) {
        if (this.shouts.isMastered(teacher)) {
            return;
        }

        const MasterModifier = this.manager.getEquipCostModifier(teacher);
        const { costs, unlocked } = this.manager.calculateEquipCost(teacher);
        const MasterCost = Math.floor(costs[unlocked - 1] * (1 + MasterModifier / 100));

        const canAfford = this.game.gp.canAfford(MasterCost);

        if (!canAfford) {
            let html = `
            <h5 class="font-w400 text-combat-smoke font-size-sm mb-2">
                You cannot afford to Master this shout:
                <img class="teacher-icon align-middle" src="${teacher.media}" />
                ${teacher.name}
            </h5>

            <h5 class="text-danger">
                <img class="skill-icon-xs mr-2" src="${this.game.gp.media}" /> ${numberWithCommas(MasterCost)} GP
            </h5>`;

            for (const modifier of this.manager.getModifiers(teacher)) {
                html += `<small class="${modifier.isActive ? 'text-success' : 'thuum-text-grey'}">`;

                if (!modifier.isActive) {
                    html += `
                    <span>
                        (<img class="skill-icon-xxs mr-1"
                               src="${assets.getURI('assets/media/main/mastery_header.svg')}" />
                               ${modifier.level})
                    </span>`;
                }

                for (let index = 0; index < modifier.description.length; index++) {
                    html += `<span class="${modifier.isActive ? modifier.description[index].isNegative ? 'text-danger' : 'text-success' : 'thuum-text-grey'}">${modifier.description[index].description}</span>`;
                }
                html += `</small><br />`
            }

            SwalLocale.fire({
                html,
                showCancelButton: false,
                icon: 'warning',
                confirmButtonText: 'Ok'
            });
        } else {
            let html = `<h5 class="font-w400 text-combat-smoke font-size-sm mb-2">
            ${getLangString('Thuum_Thuum_Would_You_Like_To_Equip_This_Shout')}
            <img class="teacher-icon align-middle" src="${teacher.media}" />
            ${teacher.name}
            </h5>

            <h5>
                <img class="skill-icon-xs mr-2" src="${this.game.gp.media}" /> ${numberWithCommas(MasterCost)} GP
            </h5>`;

            for (const modifier of this.manager.getModifiers(teacher)) {
                html += `<small class="${modifier.isActive ? 'text-success' : 'thuum-text-grey'}">`;
                if (!modifier.isActive) {
                    html += `
                    <span>
                        (<img class="skill-icon-xxs mr-1"
                        src="${assets.getURI('assets/media/main/mastery_header.svg')}" />
                        ${modifier.level})
                    </span>`;
                }
                for (let index = 0; index < modifier.description.length; index++) {
                    html += `<span class="${modifier.isActive ? modifier.description[index].isNegative ? 'text-danger' : 'text-success' : 'thuum-text-grey'}">
                    ${modifier.description[index].description}
                    </span>`;
                }
                html += `</small><br />`
            }

            html += `<h5 class="font-w600 text-danger font-size-sm mt-3 mb-1">${getLangString(
                'Thuum_Thuum_This_Will_Replace_The_Mastered_Shout'
            )}</h5>`;

            const shout1 = this.shouts.get(1);

            const masteredShouts = [shout1];

            const getText = (shout: MasteredShout) =>
                shout
                    ? templateLangString('Thuum_Thuum_Replace', { name: shout.teacher.name })
                    : getLangString('Thuum_Thuum_Equip');

            html += `<div class="shout-Master-footer mt-3"><button type="button" class="shout-1-confirm font-size-xs btn btn-primary m-1" aria-label="" value="shout-1" style="display: inline-block;">${getText(
                shout1
            )}</button>`;

            html += `</div>`;

            SwalLocale.fire({
                html,
                showCancelButton: true,
                showConfirmButton: false,
                showDenyButton: false,
                customClass: {
                    cancelButton: 'font-size-xs btn btn-danger m-1',
                    actions: 'mt-0'
                },
                icon: 'info',
                didOpen: popup => {
                    masteredShouts.forEach((shout, index) => {
                        const confirmShout = popup.querySelector<HTMLButtonElement>(`.shout-${index + 1}-confirm`);

                        if (confirmShout) {
                            confirmShout.onclick = () => {
                                this.game.gp.remove(MasterCost);

                                if (shout) {
                                    this.shouts.remove(shout.teacher);
                                }

                                const masteredShout: MasteredShout = {
                                    teacher,
                                    slot: shout?.slot ?? index + 1
                                };

                                this.shouts.set(teacher, masteredShout);

                                (<any>this.userInterface)[`shout${masteredShout.slot}`].setShout(masteredShout);
                                this.computeProvidedStats(true);

                                this.userInterface.teachers.forEach(component => {
                                    component.updateDisabled();
                                });

                                popup.querySelector<HTMLButtonElement>('.swal2-cancel').click();
                            };
                        }
                    });
                }
            });
        }
    }

    public unlockMastery(teacher: Teacher) {
        SwalLocale.fire({
            html: '<div id="thuum-mastery-container"></div>',
            showConfirmButton: false,
            showCancelButton: false,
            showDenyButton: false,
            didOpen: popup => {
                ui.create(
                    MasteryComponent(this.game, this, teacher),
                    popup.querySelector('#thuum-mastery-container')
                );
            }
        });
    }

    public getTeacherInterval(teacher: Teacher) {
        return this.modifyInterval(teacher.baseInterval, teacher);
    }

    public getFlatIntervalModifier(teacher: Teacher) {
        let modifier = super.getFlatIntervalModifier(teacher);

        return modifier;
    }

    public onLoad() {
        super.onLoad();

        for (const teacher of this.actions.registeredObjects.values()) {
            this.renderQueue.actionMastery.add(teacher);
        }
        this.computeProvidedStats(false);

        this.renderQueue.grants = true;
        this.renderQueue.shoutModifiers = true;
        this.renderQueue.visibleTeachers = true;

        if (this.isActive) {
            this.renderQueue.progressBar = true;
        }

        for (const component of this.userInterface.teachers.values()) {
            component.updateDisabled();
        }
    }

    public initSettings(settings: ThuumSettings) {
        this.settings = settings;

        this.settings.onChange(ChangeType.Modifiers, () => {
            setTimeout(() => {
                this.computeProvidedStats(true);
            }, 10);
        });
    }

    public onLevelUp(oldLevel: number, newLevel: number) {
        super.onLevelUp(oldLevel, newLevel);

        this.renderQueue.visibleTeachers = true;
    }

    public onMasteryLevelUp(action: Teacher, oldLevel: number, newLevel: number): void {
        super.onMasteryLevelUp(action, oldLevel, newLevel);

        if (newLevel >= action.level) {
            this.computeProvidedStats(true);
        }

        this.renderQueue.gpRange = true;
        this.renderQueue.shoutModifiers = true;
    }

    public onModifierChange() {
        super.onModifierChange();

        this.renderQueue.grants = true;
        this.renderQueue.gpRange = true;
        this.renderQueue.shoutModifiers = true;
    }

    public render() {
        super.render();

        this.renderProgressBar();
        this.renderGrants();
        this.renderGPRange();
        this.renderShoutModifiers();
        this.renderVisibleTeachers();
    }

    public postDataRegistration() {
        super.postDataRegistration();


        this.sortedMasteryActions = this.actions.allObjects.sort((a, b) => a.level - b.level);
        this.actions.forEach((action) => {
            if (action.abyssalLevel > 0)
                this.abyssalMilestones.push(action);
            else
                this.milestones.push(action);
        }
        );
        // this.milestones.push(...this.actions.allObjects);

        this.sortMilestones();

        for (const action of this.actions.allObjects) {
            this.masteriesUnlocked.set(action, [true, false, false, false]);
        }

        const capesToExclude = ['melvorF:Max_Skillcape'];

        if (cloudManager.hasTotHEntitlementAndIsEnabled) {
            capesToExclude.push('melvorTotH:Superior_Max_Skillcape');
        }

        const skillCapes = this.game.shop.purchases.filter(purchase => capesToExclude.includes(purchase.id));

        for (const cape of skillCapes) {
            const allSkillLevelsRequirement = cape.purchaseRequirements.find(
                req => req.type === 'AllSkillLevels'
            ) as AllSkillLevelRequirement;

            if (allSkillLevelsRequirement !== undefined) {
                if (allSkillLevelsRequirement.exceptions === undefined) {
                    allSkillLevelsRequirement.exceptions = new Set();
                }

                allSkillLevelsRequirement.exceptions.add(this);
            }
        }
    }

    public preAction() { }

    public postAction() {
        this.renderQueue.grants = true;
    }

    public onEquipmentChange() { }

    public addProvidedStats() {
        super.addProvidedStats();

        for (const shout of this.shouts.all()) {
            const modifiers = this.manager.getModifiersForApplication(shout.teacher);
            for (const modifier of modifiers) {
                this.providedStats.addStatObject(shout.teacher, modifier);
            }
        }
    }

    public isMasteryActionUnlocked(action: Teacher) {
        return this.isBasicSkillRecipeUnlocked(action);
    }


    public get actionRewards() {
        const rewards = new Rewards(this.game);
        const actionEvent = new ThuumActionEvent(this, this.activeTeacher);
        const costs = new Costs(this.game);

        if (this.activeTeacher.baseAbyssalExperience) {
            rewards.addAbyssalXP(this, this.activeTeacher.baseAbyssalExperience);
        }
        rewards.addXP(this, this.activeTeacher.baseExperience);
        rewards.setActionInterval(this.actionInterval);
        costs.addGP(this.manager.getGoldToTake(this.activeTeacher))
        costs.consumeCosts()
        this.addCommonRewards(rewards, this.activeTeacher);

        actionEvent.interval = this.currentActionInterval;
        this._events.emit('action', actionEvent);

        return rewards;
    }

    public getXPModifier(teacher?: Teacher) {
        let modifier = super.getXPModifier(teacher);

        return modifier;
    }

    public getMasteryXPModifier(teacher: Teacher) {
        let modifier = super.getMasteryXPModifier(teacher);

        return modifier;
    }

    public renderGrants() {
        if (!this.renderQueue.grants) {
            return;
        }
        for (const component of this.userInterface.teachers.values()) {
            const masteryXP = Math.max(1, this.getMasteryXPToAddForAction(
                component.teacher,
                this.getTeacherInterval(component.teacher)
            ));

            const baseMasteryXP = Math.max(1, this.getBaseMasteryXPToAddForAction(
                component.teacher,
                this.getTeacherInterval(component.teacher)
            ));

            const poolXP = this.getMasteryXPToAddToPool(masteryXP);
            if (component.teacher.abyssalLevel > 0) {
                component.updateGrants(
                    this.modifyAbyssalXP(component.teacher.baseAbyssalExperience, component.teacher),
                    component.teacher.baseAbyssalExperience,
                    masteryXP,
                    baseMasteryXP,
                    poolXP,
                    this.getTeacherInterval(component.teacher),
                    this.game.realms.getObjectByID('melvorItA:Abyssal')
                );
            } else {
                component.updateGrants(
                    this.modifyXP(component.teacher.baseExperience, component.teacher),
                    component.teacher.baseExperience,
                    masteryXP,
                    baseMasteryXP,
                    poolXP,
                    this.getTeacherInterval(component.teacher),
                    this.game.defaultRealm
                );
            }
        }
        this.renderQueue.grants = false;
    }

    public renderGPRange() {
        if (!this.renderQueue.gpRange) {
            return;
        }

        for (const component of this.userInterface.teachers.values()) {
            component.updateGPRange();
        }

        this.renderQueue.gpRange = false;
    }

    public renderShoutModifiers() {
        if (!this.renderQueue.shoutModifiers) {
            return;
        }

        this.userInterface.shout1.updateEnabled(true); // Shout 1 is always available.

        this.userInterface.shout1.updateModifiers();

        this.userInterface.shout1.updateCurrentMasteryLevel();

        this.renderQueue.shoutModifiers = false;
    }

    public renderProgressBar() {
        if (!this.renderQueue.progressBar) {
            return;
        }

        const progressBar = this.userInterface.teachers.get(this.activeTeacher)?.progressBar;

        if (progressBar !== this.renderedProgressBar) {
            this.renderedProgressBar?.stopAnimation();
        }

        if (progressBar !== undefined) {
            if (this.isActive) {
                progressBar.animateProgressFromTimer(this.actionTimer);
                this.renderedProgressBar = progressBar;
            } else {
                progressBar.stopAnimation();
                this.renderedProgressBar = undefined;
            }
        }

        this.renderQueue.progressBar = false;
    }

    public renderVisibleTeachers() {
        if (!this.renderQueue.visibleTeachers) {
            return;
        }

        for (const teacher of this.actions.registeredObjects.values()) {
            const menu = this.userInterface.teachers.get(teacher);

            if (menu === undefined) {
                return;
            }

            const element = document.querySelector(`#${menu.localId}`) as HTMLElement;

            if (!element) {
                return;
            }

            if (this.level >= teacher.level) {
                showElement(element);
            } else {
                hideElement(element);
            }
        }

        this.userInterface.locked.update();

        this.renderQueue.visibleTeachers = false;
    }

    public getRegistry(type: ScopeSourceType) {
        switch (type) {
            case ScopeSourceType.Action:
                return this.actions;
        }
    }

    public resetActionState() {
        super.resetActionState();

        this.activeTeacher = undefined;
        this.shouts.clear();
    }

    public encode(writer: SaveWriter): SaveWriter {
        super.encode(writer);

        writer.writeUint32(this.version); // writes save version
        writer.writeBoolean(this.activeTeacher !== undefined); // true:false is activeTeacher
        // Save teacher
        if (this.activeTeacher) {
            writer.writeNamespacedObject(this.activeTeacher); // write an object of active teacher if one is active            
        }
        // Save masteries
        writer.writeArray(this.actions.allObjects, action => {
            writer.writeNamespacedObject(action); // write object of all actions

            const masteriesUnlocked = this.masteriesUnlocked.get(action);

            writer.writeArray(masteriesUnlocked, value => {
                writer.writeBoolean(value); // write the mastery values, [true, false, false, false]
            });
        });
        // Save shouts progress
        writer.writeComplexMap(this.shouts.shouts, (key, value, writer) => {
            writer.writeNamespacedObject(key); // write shouts keys
            writer.writeUint32(value.slot); // write shouts values
        });

        return writer;
    }

    public decode(reader: SaveWriter, version: number): void {
        super.decode(reader, version);

        const decoder = new Decoder(this.game, this, reader.byteOffset);

        decoder.decode(reader);
    }

    /** Fix completion log bug which passes through base game namespace even for modded skills. */
    public getMaxTotalMasteryLevels() {
        return super.getMaxTotalMasteryLevels(this.namespace);
    }

    /** Fix completion log bug which passes through base game namespace even for modded skills. */
    public getTotalCurrentMasteryLevels() {
        return super.getTotalCurrentMasteryLevels(this.namespace);
    }

    public getActionIDFromOldID(oldActionID: number, idMap: NumericIDMap) {
        return '';
    }
}

export class ThuumRenderQueue extends GatheringSkillRenderQueue<Teacher> {
    grants = false;
    gpRange = false;
    shoutModifiers = false;
    visibleTeachers = false;
}
