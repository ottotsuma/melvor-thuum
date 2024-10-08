import { ThuumActionEventMatcher, ThuumActionEventMatcherOptions } from "./thuum/event";
import { Thuum } from "./thuum/thuum";
import { UserInterface } from "./thuum/user-interface";
import { ThuumTownship } from "./township/township";
import { TinyPassiveIconsCompatibility } from "./compatibility/tiny-passive-icons";
import { ThuumSkillData } from "./thuum/thuum.types";
import { languages } from "./language";
import { ThuumTranslation } from "./translation/translation";
import { ThuumSettings } from "./thuum/settings";

declare global {
    interface CloudManager {
        hasTotHEntitlementAndIsEnabled: boolean;
        hasAoDEntitlementAndIsEnabled: boolean;
        hasItAEntitlementAndIsEnabled: boolean;
    }

    const cloudManager: CloudManager;

    interface SkillIDDataMap {
        "namespace_thuum:Thuum": ThuumSkillData;
    }

    interface SkillValue {
        skill: AnySkill;
        value: number;
    }

    interface Game {
        thuum: Thuum;
    }

    interface Gamemode {
        /** The number of skill cap increase choices obtained per dungeon completion before Level 99 if allowDungeonLevelCapIncrease = true */
        skillCapIncreasesPre99: number;
        /** The number of skill cap increase choices obtained per dungeon completion after Level 99 if allowDungeonLevelCapIncrease = true */
        skillCapIncreasesPost99: number;
        /** Skills that auto level per dungeon completion before Level 99 if allowDungeonLevelCapIncrease = true */
        autoLevelSkillsPre99: SkillValue[];
        /** Skills that auto level per dungeon completion after Level 99 if allowDungeonLevelCapIncrease = true */
        autoLevelSkillsPost99: SkillValue[];
        /** Skills that are part of the cap increase pool before Level 99 obtained per dungeon completion if allowDungeonLevelCapIncrease = true */
        skillCapRollsPre99: SkillValue[];
        /** Skills that are part of the cap increase pool after Level 99 obtained per dungeon completion if allowDungeonLevelCapIncrease = true */
        skillCapRollsPost99: SkillValue[];
    }
}

export class App {
    constructor(private readonly context: Modding.ModContext, private readonly game: Game) { }

    public async init() {
        // mod.api.mythCombatSimulator?.registerNamespace('namespace_thuum');
        await this.context.loadTemplates("thuum/thuum.html");
        await this.context.loadTemplates("thuum/teacher/teacher.html");
        await this.context.loadTemplates("thuum/shout/shout.html");
        await this.context.loadTemplates("thuum/mastery/mastery.html");
        await this.context.loadTemplates("thuum/locked/locked.html");

        this.initLanguage();
        this.initTranslation();
        const settings = this.initSettings();
        this.patchEventManager();

        this.game.thuum = this.game.registerSkill(this.game.registeredNamespaces.getNamespace("namespace_thuum"), Thuum);

        await this.context.gameData.addPackage("data.json");

        const DragonList: any[] = [
            "melvorD:PratTheProtectorOfSecrets",
            "melvorD:GreenDragon",
            "melvorD:BlueDragon",
            "melvorD:RedDragon",
            "melvorD:BlackDragon",
            "melvorD:MalcsTheGuardianOfMelvor",
            "melvorF:ElderDragon",
            "melvorF:ChaoticGreaterDragon",
            "melvorF:HuntingGreaterDragon",
            "melvorF:WickedGreaterDragon",
            "melvorF:MalcsTheLeaderOfDragons",
            "melvorF:GreaterSkeletalDragon",
        ]
        if (cloudManager.hasAoDEntitlementAndIsEnabled) {
            await this.context.gameData.addPackage("data-aod.json");
            if(!game.skills.getObjectByID('namespace_thuum:Thuum')._unlocked) {  
                game.skills.getObjectByID('namespace_thuum:Thuum').setUnlock(true)
            }
        }
        this.context.onModsLoaded(async () => {
            if (cloudManager.hasTotHEntitlementAndIsEnabled) {
                await this.context.gameData.addPackage("data-toth.json");

                DragonList.push(
                    "melvorTotH:Kongamato", "melvorTotH:GretYun", "melvorTotH:RaZu",
                )

                await this.context.gameData
                    .buildPackage(builder => {
                        builder.skillData.add({ // @ts-ignore
                            skillID: "namespace_thuum:Thuum",
                            data: {
                                minibar: {
                                    defaultItems: ["namespace_thuum:Superior_Thuum_Skillcape"],
                                    upgrades: [],
                                    pets: []
                                }, // @ts-ignore
                                teachers: [],
                                upgrades: []
                            }
                        });
                    })
                    .add();
            }
            if (cloudManager.hasItAEntitlementAndIsEnabled) {
                await this.context.gameData.addPackage("data-abyss.json");
            }
            const kcm = mod.manager.getLoadedModList().includes("Custom Modifiers in Melvor")
            const profileSkill = mod.manager.getLoadedModList().includes("(Skill) Classes and Species")
            const mythLoaded = mod.manager.getLoadedModList().includes("[Myth] Music")

            if (mythLoaded) {
                await this.context.gameData.addPackage("music.json");
            }
            if (kcm) {
                await this.context.gameData.addPackage("data-cmim.json");
            }
            if (kcm && profileSkill) {
                await this.context.gameData.addPackage("profile.json");
            }
            if (kcm) {
                const cmim = mod.api.customModifiersInMelvor;
                cmim.addMonsters("Dragon", DragonList)
                cmim.addMonsters("Elf", [])
                cmim.registerOrUpdateType("Goblin", "Goblins", "https://cdn.melvor.net/core/v018/assets/media/monsters/goblin.png", [], true);
                cmim.forceBaseModTypeActive("Elf");
                cmim.forceBaseModTypeActive("Dragon");
                cmim.forceBaseModTypeActive("Undead");
                cmim.forceBaseModTypeActive("Human");
                cmim.forceBaseModTypeActive("Animal");
                cmim.forceBaseModTypeActive("Demon");
                cmim.forceBaseModTypeActive("Elemental");
                cmim.forceBaseModTypeActive("MythicalCreature");
                cmim.forceBaseModTypeActive("SeaCreature");
                const cmimDragonList = await cmim.getMonstersOfType("Dragon");
                const initialPackage = this.context.gameData.buildPackage(builder => {
                    for (let index = 0; index < cmimDragonList.length; index++) {
                        builder.monsters.modify({
                            "id": cmimDragonList[index],
                            "lootTable": {
                                "add": [
                                    {
                                        "itemID": "namespace_thuum:Dragon_Soul",
                                        "maxQuantity": 1,
                                        "minQuantity": 1,
                                        "weight": 1
                                    }
                                ]
                            }
                        });
                    }
                })
                initialPackage.add();
                // this.game.thuum.changesMade = initialPackage
            } else {
                for (let index = 0; index < DragonList.length; index++) {
                    await this.context.gameData.buildPackage(builder => {
                        builder.monsters.modify({
                            "id": DragonList[index],
                            "lootTable": {
                                "add": [
                                    {
                                        "itemID": "namespace_thuum:Dragon_Soul",
                                        "maxQuantity": 1,
                                        "minQuantity": 1,
                                        "weight": 1
                                    }
                                ]
                            }
                        });
                    }).add();
                }
            }
        })
        await this.initGamemodes();
        // this.patchGamemodes(this.game.thuum);
        this.patchUnlock(this.game.thuum);
        this.initCompatibility(this.game.thuum);
        this.initTownship();

        this.game.thuum.userInterface = this.initInterface(this.game.thuum);
        this.game.thuum.initSettings(settings);
    }

    private patchEventManager() {
        this.context.patch(GameEventSystem, "constructMatcher").after((_patch, data) => {
            if (this.isThuumEvent(data)) {
                return new ThuumActionEventMatcher(data, this.game) as any;
            }
        });
    }

    // private patchGamemodes(thuum: Thuum) {
    //     this.game.gamemodes.forEach(gamemode => {
    //         if (gamemode.allowDungeonLevelCapIncrease) {
    //             if (!gamemode.startingSkills) {
    //                 gamemode.startingSkills = new Set();
    //             }

    //             if (!gamemode.autoLevelSkillsPre99) {
    //                 gamemode.autoLevelSkillsPre99 = [];
    //             }

    //             if (!gamemode.autoLevelSkillsPost99) {
    //                 gamemode.autoLevelSkillsPost99 = [];
    //             }

    //             gamemode.startingSkills.add(thuum);
    //             gamemode.autoLevelSkillsPre99.push({ skill: thuum, value: 5 });
    //             gamemode.autoLevelSkillsPost99.push({ skill: thuum, value: 3 });
    //         }
    //     });
    // }

    private patchUnlock(thuum: Thuum) {
        this.context.patch(EventManager, "loadEvents").after(() => {
            if(this.game.currentGamemode.allowSkillUnlock) {
                thuum.setUnlock(true);
                thuum.increaseLevelCap = this.game.attack.increaseLevelCap
            }
        });
    }

    private isThuumEvent(
        data: GameEventMatcherData | ThuumActionEventMatcherOptions
    ): data is ThuumActionEventMatcherOptions {
        return data.type === "ThuumAction";
    }

    private async initGamemodes() {
        if (cloudManager.hasAoDEntitlementAndIsEnabled) {
            const levelCapIncreases = ['namespace_thuum:Pre99Dungeons', 'namespace_thuum:ImpendingDarknessSet100'];

            if (cloudManager.hasTotHEntitlementAndIsEnabled) {
                levelCapIncreases.push(...['namespace_thuum:Post99Dungeons', 'namespace_thuum:ThroneOfTheHeraldSet120']);
            }

            const gamemodes = this.game.gamemodes.filter(gamemode => gamemode.allowAncientRelicDrops);

            await this.context.gameData.addPackage({
                $schema: '',
                namespace: 'namespace_thuum:Thuum',
                modifications: {
                    gamemodes: gamemodes.map(gamemode => ({
                        id: gamemode.id,
                        levelCapIncreases: {
                            add: levelCapIncreases
                        },
                        startingSkills: {
                            add: ['namespace_thuum:Thuum']
                        },
                        skillUnlockRequirements: [
                            {
                                skillID: 'namespace_thuum:Thuum',
                                requirements: [
                                    {
                                        type: 'SkillLevel',
                                        skillID: 'melvorD:Attack',
                                        level: 1
                                    }
                                ]
                            }
                        ]
                    }))
                }
            });
        }
    }

    private initSettings() {
        const settings = new ThuumSettings(this.context);

        settings.init();

        return settings;
    }

    private initTownship() {
        const township = new ThuumTownship(this.context, this.game);

        township.register();
    }

    private initCompatibility(thuum: Thuum) {
        const tinyPassiveIcons = new TinyPassiveIconsCompatibility(this.context, thuum);

        tinyPassiveIcons.patch();
    }

    private initInterface(thuum: Thuum) {
        const userInterface = new UserInterface(this.context, this.game, thuum);

        userInterface.init();

        return userInterface;
    }

    private initTranslation() {
        const translation = new ThuumTranslation(this.context);

        translation.init();
    }

    private initLanguage() {
        let lang = setLang;

        if (lang === "lemon" || lang === "carrot") {
            lang = "en";
        }

        const keysToNotPrefix = [
            "MASTERY_CHECKPOINT",
            "MASTERY_BONUS",
            "POTION_NAME",
            "PET_NAME",
            "ITEM_NAME",
            "ITEM_DESCRIPTION",
            "SHOP_NAME",
            "SHOP_DESCRIPTION",
            "MONSTER_NAME",
            "COMBAT_AREA_NAME",
            "SPECIAL_ATTACK_NAME",
            "SPECIAL_ATTACK_DESCRIPTION",
            "mod_",
            "PASSIVES_NAME_",
            "MODIFIER_DATA_",
            "Profile_",
            "tes_",
            "Myth_Music_"
        ];

        for (const [key, value] of Object.entries<string>(languages[lang])) {
            if (keysToNotPrefix.some(prefix => key.includes(prefix))) {
                loadedLangJson[key] = value;
            } else {
                loadedLangJson[`Thuum_Thuum_${key}`] = value;
            }
        }
    }
}