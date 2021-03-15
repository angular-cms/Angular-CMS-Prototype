import { DocumentNotFoundException } from '../../error';
import { pick } from '../../utils/pick';
import { Validator } from '../../validation/validator';
import { FolderService } from '../folder/folder.service';
import { ObjectId, PaginateOptions, QueryResult, QuerySort } from '../shared/base.model';
import { ContentVersionService } from './content-version.service';
import {
    IContentDocument,
    IContentLanguageDocument,
    IContentModel, IContentVersionDocument,
    IContentVersionModel
} from './content.model';
import { VersionStatus } from "./version-status";
import { QueryHelper } from './query-helper';
import { isNil, isNilOrWhiteSpace } from '../../utils';

export class ContentService<T extends IContentDocument, P extends IContentLanguageDocument, V extends IContentVersionDocument> extends FolderService<T, P> {
    protected contentVersionService: ContentVersionService<V>;

    constructor(contentModel: IContentModel<T>, contentVersionModel: IContentVersionModel<V>) {
        super(contentModel);
        this.contentVersionService = new ContentVersionService<V>(contentVersionModel);
    }

    /**
     * Get content version detail 
     * 
     * If the version Id is not provided, the primary version based on language will be used instead
     * @param id (`Required`) The content's id
     * @param versionId (`Required` but null is allowed)  the version id, if value is null, the primary version based on language will be used
     * @param language (`Required`) The language code (ex 'en', 'de'...)
     * 
     */
    async getContentVersion(id: string, versionId: string, language: string, host?: string): Promise<T & V> {
        Validator.throwIfNullOrEmpty('contentId', id);
        Validator.throwIfNullOrEmpty('language', language);

        const currentContent = await this.findOne({ _id: id, isDeleted: false } as any, { lean: true }).exec();
        Validator.throwIfNotFound('Content', currentContent, { _id: id, isDeleted: false });

        const query: any = versionId ? { _id: versionId, contentId: id } : { isPrimary: true, contentId: id, language };

        const currentVersion = await this.contentVersionService.findOne(query, { lean: true })
            .populate({
                path: 'childItems.content',
                match: {
                    isDeleted: false,
                    contentLanguages: { $elemMatch: { language } }
                },
                select: {
                    contentLanguages: { $elemMatch: { language } }
                }
            }).exec();

        if (currentVersion.childItems) {
            currentVersion.childItems.forEach(item => {
                const childContentLang = item.content?.contentLanguages?.find(contentLanguage => contentLanguage.language === language);
                item.content = this.mergeToContentLanguage(item.content, childContentLang)
            })
        }

        return this.mergeToContentVersion(currentContent, currentVersion);
    }

    /**
     * Get content detail without deep populate the child reference items
     * @param id The content id
     * @param language The language code (ex 'en', 'de'...)
     * @param statuses The array of statuses VersionStatus[]
     * @param select The mongoose select syntax like 'a,-b,c'
     */
    async getContent(id: string, language: string, statuses?: number[], select?: string): Promise<T & P> {
        Validator.throwIfNull('contentId', id);

        const filter = {
            _id: ObjectId(id),
            isDeleted: false,
            language,
            status: statuses ? { $in: statuses } : undefined
        }

        const queryResult = await this.queryContent(filter, select);
        if (queryResult.docs.length == 0)
            Validator.throwIfNotFound('Content', null, { _id: id, isDeleted: false, status: statuses, language });

        return queryResult.docs[0];
    }

    /**
     * Gets content children by parent id
     * @param parentId 
     * @param language 
     * @param host optional
     * @param select The fields select syntax like 'a,-b,c'
     * @returns The array of children 
     */
    async getContentChildren(parentId: string, language: string, host?: string, select?: string): Promise<Array<T & P>> {
        if (parentId == '0') parentId = null;

        const filter = {
            parentId: parentId ? ObjectId(parentId) : null,
            contentType: { $ne: null },
            isDeleted: false,
            language
        };

        const queryResult = await this.queryContent(filter, select);
        return queryResult.docs;
    }

    async getAncestors(id: string, language: string, host?: string, select?: string) {
        const content = await this.getContent(id, language, null, '_id, parentId, parentPath, ancestors');
        Validator.throwIfNotFound('getAncestors of content', { id, language, select });

        const parentIds = content.parentPath.split(',').filter(id => !isNilOrWhiteSpace(id));
        const filter = {
            _id: { $in: parentIds },
            language
        }
        const resultQuery = await this.queryContent(filter, select);
        const ancestors = resultQuery.docs;
        const orderedAncestors = [];
        parentIds.forEach(pid => {
            const ancestor = ancestors.find(x => x._id.toString() === pid);
            if (ancestor) {
                orderedAncestors.push(ancestor);
            }
        });
        return orderedAncestors;
    }

    /**
     * Gets content items details by array of ids
     * @param ids 
     * @param language 
     * @param [statuses] (Optional) 
     * @param [project] (Optional)
     * @param [isDeepPopulate] (Optional)
     * @returns content items 
     */
    async getContentItems(ids: string[], language: string, statuses?: number[], project?: { [key: string]: any }, isDeepPopulate: boolean = false): Promise<Array<T & P>> {
        Validator.throwIfNullOrEmpty('language', language);

        const languagesFilter = statuses ? { language, status: { $in: statuses } } : { language };
        const filter = { _id: { $in: ids }, isDeleted: false, contentLanguages: { $elemMatch: languagesFilter } };

        let queryBuilder = this.find(filter as any, { lean: true });
        // project the out fields
        if (project) {
            if (!project.hasOwnProperty('contentLanguages')) { Object.assign(project, { contentLanguages: { $elemMatch: languagesFilter } }); }
            queryBuilder = queryBuilder.select(project);
        } else {
            queryBuilder = queryBuilder.select({
                _id: 1,
                parentId: 1,
                parentPath: 1,
                contentType: 1,
                isDeleted: 1,
                deletedBy: 1,
                visibleInMenu: 1,
                createdBy: 1,
                createdAt: 1,
                updatedAt: 1,
                contentLanguages: { $elemMatch: languagesFilter }
            })
        }
        // deep populate
        if (isDeepPopulate) {
            queryBuilder = queryBuilder.populate(QueryHelper.deepPopulate(5, language));
        }

        const contents = await queryBuilder.exec();

        const publishedContents: Array<T & P> = [];
        contents.forEach(content => {
            const publishedLang = content.contentLanguages.find((contentLang: P) => contentLang.language === language) as P;
            publishedContents.push(this.mergeToContentLanguage(content, publishedLang));
        })

        return publishedContents;
    }

    /**
     * Query content using aggregation function
     * @param filter {FilterQuery<T & P>} The filter to query content
     * @param project {string | { [key: string]: any }} (Optional) project aggregation for example: { name: 1, language: 1} or `'name,language'`
     * @param {QuerySort} [sort] - Sort option in the format: `'a,b, -c'` or `{a:1, b: 'asc', c: -1}`
     * @param {number} [page] - Current page (default = 1)
     * @param {number} [limit] - Maximum number of results per page (default = 10)
     * @returns {Object} Return `PaginateResult` object
     */
    async queryContent(
        filter: any,
        project?: string | { [key: string]: any },
        sort?: string | QuerySort,
        page?: number,
        limit?: number
    ): Promise<QueryResult<T & P>> {
        // IContent filter
        const contentFilter = QueryHelper.getContentFilter(filter);
        // IContentLanguage filter
        const contentLangFilter = QueryHelper.getContentLanguageFilter(filter);
        // project
        const contentProject = QueryHelper.getContentProjection(project);

        // aggregation query
        let queryBuilder = this.Model.aggregate<any>()
            .match(contentFilter)
            .unwind('$contentLanguages')
            .match(contentLangFilter)
            .project(contentProject)

        if (!isNil(page) && !isNil(limit)) {
            const skip = (page - 1) * limit;
            const contentSort = QueryHelper.getCombineContentSort(sort);
            queryBuilder = queryBuilder
                .facet({
                    metadata: [{ $count: 'total' }],
                    docs: [
                        // Since the name can be duplicated, adding createdAt to making sort is stable
                        { $sort: contentSort },
                        { $skip: skip },
                        { $limit: limit },
                        // merge language branch into the original document
                        { $replaceRoot: { newRoot: { $mergeObjects: ["$contentLanguages", "$$ROOT"] } } },
                        { $project: { "contentLanguages": 0 } }
                    ]
                })
                // after $facet, its output {metadata: [ { total: 10000 } ],docs: [ { x }, { y }, ... ]}
                .unwind('$metadata')
                .project({
                    docs: 1,
                    // Get total from the first element of the metadata array 
                    total: '$metadata.total',
                    pages: {
                        $ceil: {
                            $divide: ['$metadata.total', limit]
                        }
                    }
                });
            //  [{ total: 10000, pages: 35,  docs: [ { x }, { y }, ... ]  }] // output
            const result = await queryBuilder;
            return result && result.length > 0 ? Object.assign(result[0], { page, limit }) : {
                docs: [],
                total: 0,
                pages: 0,
                page,
                limit
            }
        } else {
            if (!isNil(sort)) {
                const contentSort = QueryHelper.getCombineContentSort(sort);
                queryBuilder = queryBuilder.sort(contentSort);
            }
            queryBuilder = queryBuilder
                .replaceRoot({ $mergeObjects: ["$contentLanguages", "$$ROOT"] })
                .project({ "contentLanguages": 0 })
            const documents = await queryBuilder;
            return {
                docs: documents
            }
        }
    }

    /**
     * Create block or media content
     * @param content 
     */
    async executeCreateContentFlow(content: T & P, language: string, userId: string): Promise<T & V> {
        const parentContent = await this.findById(content.parentId).exec();
        //Step1: Create content
        content.masterLanguageId = language;
        const savedContent = await this.createContent(content, parentContent, userId);
        //Step2: Create content version
        const savedContentVersionDoc = await this.contentVersionService.createNewVersion(content as any, savedContent._id.toString(), userId, language);
        //Step3: update primary version
        await this.contentVersionService.setPrimaryVersion(savedContentVersionDoc._id.toString());
        //Step3: Create content in language 
        const contentLanguage = this.createContentLanguage(content, savedContentVersionDoc._id.toString(), userId, language);
        savedContent.contentLanguages.push(contentLanguage);
        await savedContent.save();

        return this.mergeToContentVersion(savedContent, savedContentVersionDoc);
    }

    protected createContent = (newContent: T, parentContent: T, userId: string): Promise<T> => {
        newContent.createdBy = userId;
        newContent.parentId = parentContent ? parentContent._id : null;

        //create parent path ids
        if (parentContent) {
            newContent.parentPath = parentContent.parentPath ? `${parentContent.parentPath}${parentContent._id},` : `,${parentContent._id},`;

            const ancestors = parentContent.ancestors.slice();
            ancestors.push(parentContent._id.toString());
            newContent.ancestors = ancestors
        } else {
            newContent.parentPath = null;
            newContent.ancestors = [];
        }
        //init contentLanguages if it null
        if (!newContent.contentLanguages) newContent.contentLanguages = [];

        return this.create(newContent);
    }

    private createContentLanguage(content: P, versionId: string, userId: string, language: string): P {
        Validator.throwIfNull('content body', content);
        Validator.throwIfNullOrEmpty('language', language);
        Validator.throwIfNullOrEmpty('userId', userId);

        const contentLangDoc = { ...content };
        contentLangDoc._id = undefined;
        contentLangDoc.versionId = versionId;
        contentLangDoc.language = language;
        contentLangDoc.createdBy = userId;
        contentLangDoc.status = VersionStatus.CheckedOut;

        return contentLangDoc;
    }

    protected updateHasChildren = async (content: IContentDocument): Promise<boolean> => {
        if (!content) return false;
        if (content && content.hasChildren) return true;

        content.hasChildren = true;
        const savedContent = await content.save();
        return savedContent.hasChildren;
    }

    /**
     * Execute update content flow of content service
     * @returns the newest version in current language
     */
    public executeUpdateContentFlow = async (id: string, versionId: string, userId: string, contentObj: T & V): Promise<T & V> => {
        //Step1: Get current version
        const currentVersion = await this.contentVersionService.getVersionById(versionId);
        const currentContent = currentVersion.contentId as T;
        const { language } = currentVersion;

        const isDraftVersion = VersionStatus.isDraftVersion(currentVersion.status);
        if (isDraftVersion) {
            //Step1: update corresponding content language if this language is not publish yet
            const contentLanguage = currentContent.contentLanguages.find(c => c.language == language);
            Validator.throwIfNotFound('ContentLanguage', contentLanguage, { contentId: id, language });

            if (VersionStatus.isDraftVersion(contentLanguage.status)) {
                Object.assign(contentLanguage, contentObj, { updatedBy: userId });
                await currentContent.save();
            }
            //Step2: update current version
            Object.assign(currentVersion, contentObj, { savedAt: new Date(), updatedBy: userId, savedBy: userId });
            const saveContentVersion = await currentVersion.save();

            return this.mergeToContentVersion(currentContent, saveContentVersion);
        } else {
            //Create new version from current version
            const newContentVersion = Object.assign(currentVersion.toJSON(), contentObj)
            const savedContentVersionDoc = await this.contentVersionService.createNewVersion(newContentVersion, id, userId, language, currentVersion._id.toString());
            //Check if there is any draft version which marked as primary
            const primaryDraftVersion = await this.contentVersionService.getPrimaryDraftVersion(id, language);
            //If there is not any primary draft version --> update primary version 
            if (!primaryDraftVersion) {
                await this.contentVersionService.setPrimaryVersion(savedContentVersionDoc._id.toString());
            }
            return this.mergeToContentVersion(currentContent, savedContentVersionDoc);
        }
    }

    /**
     * Execute publish content flow of content service
     * @returns the published version in current language
     */
    async executePublishContentFlow(id: string, versionId: string, userId: string, host?: string): Promise<T & V> {
        //Step1: Get current version
        const currentVersion = await this.contentVersionService.getVersionById(versionId);
        const { language, contentId } = currentVersion;

        const currentContent = contentId as T;
        const contentLanguage = currentContent.contentLanguages.find(c => c.language == language);
        Validator.throwIfNotFound('ContentLanguage', contentLanguage, { contentId: id, language });

        const isDraftVersion = VersionStatus.isDraftVersion(currentVersion.status);
        if (isDraftVersion) {
            //Step2: publish the current version
            currentVersion.status = VersionStatus.Published;
            currentVersion.startPublish = new Date();
            currentVersion.publishedBy = userId;
            currentVersion.savedAt = new Date();
            currentVersion.savedBy = userId;
            currentVersion.masterVersionId = null;
            await currentVersion.save();

            //Step3: override the content language by publish version
            const previousVersionId = contentLanguage.versionId;
            const { status, startPublish, publishedBy, name, properties, childItems, _id } = currentVersion;
            const pageObject = pick(currentVersion, ['urlSegment', 'simpleAddress']);
            Object.assign(contentLanguage, pageObject, { status, startPublish, publishedBy, name, properties, childItems, versionId: _id.toString() });

            //Step4: override the content by publish version
            const { childOrderRule, peerOrder, visibleInMenu } = currentVersion;
            Object.assign(currentContent, { childOrderRule, peerOrder, visibleInMenu });
            await currentContent.save();

            //Step5: update previous version to PreviewPublished
            if (previousVersionId != currentVersion._id.toString()) {
                await this.contentVersionService.updateById(previousVersionId, { status: VersionStatus.PreviouslyPublished } as any);
            }
        }

        return this.mergeToContentVersion(currentContent, currentVersion);
    }

    /**
     * Execute delete content flow of content service
     */
    public executeMoveContentToTrashFlow = async (id: string, userId: string): Promise<T> => {
        //find page
        const currentContent = await this.findById(id).exec();
        if (!currentContent) throw new DocumentNotFoundException(id);
        const result: [T, any] = await Promise.all([
            //soft delete page
            this.softDeleteContent(currentContent, userId),
            //soft delete page's children
            this.softDeleteContentChildren(currentContent, userId)
        ]);

        //update the 'HasChildren' field of page's parent
        const childCount = await this.countChildrenOfContent(currentContent);
        if (childCount == 0) await this.updateById(currentContent.parentId, { hasChildren: false } as any)

        return result[0];
    }

    private countChildrenOfContent = (currentContent: T): Promise<number> => {
        // In case delete content: page, block, media
        if (currentContent.contentType) {
            return this.count({ parentId: currentContent.parentId, isDeleted: false } as any)
        }
        // In case delete folder
        return this.count({ parentId: currentContent.parentId, isDeleted: false, contentType: null } as any)
    }

    private softDeleteContent = async (currentContent: T, userId: string): Promise<T> => {
        currentContent.isDeleted = true;
        currentContent.deletedBy = userId;
        currentContent.deletedAt = new Date();
        return currentContent.save();
    }

    private softDeleteContentChildren = (currentContent: T, userId: string): Promise<any> => {
        if (!currentContent.parentPath) currentContent.parentPath = ',';

        const startWithParentPathRegExp = new RegExp("^" + `${currentContent.parentPath}${currentContent._id},`);
        const conditions = { parentPath: { $regex: startWithParentPathRegExp } };
        const updateFields: Partial<IContentDocument> = { isDeleted: true, deletedBy: userId, deletedAt: new Date() };
        return this.updateMany(conditions as any, updateFields as any).exec()
    }

    /**
     * Execute the copy content flow
     * @param sourceContentId 
     * @param targetParentId 
     */
    public executeCopyContentFlow = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        const copiedContent = await this.createCopiedContent(sourceContentId, targetParentId, userId);
        await this.createCopiedChildrenContent(sourceContentId, copiedContent, userId);

        return copiedContent;
    }

    private createCopiedContent = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        //get source content 
        const sourceContent = await this.findById(sourceContentId, { lean: true }).exec();
        if (!sourceContent) throw new DocumentNotFoundException(sourceContentId);

        //get source latest version content in each language
        const sourceVersions = await this.contentVersionService.find({ contentId: sourceContent._id } as any, { lean: true }).exec();

        const latestVersion: { [key: string]: V } = {};
        sourceVersions.forEach(version => {
            const previousVer = latestVersion[version.language]
            if (!previousVer) {
                latestVersion[version.language] = version;
                return;
            }
            if (previousVer.language === version.language && previousVer.createdAt < version.createdAt)
                latestVersion[version.language] = version;
        })
        const copyVersions = Object.entries(latestVersion).map(([language, version]: [string, V]) => version);

        //create copy content
        const newContent = sourceContent.toObject() as any;
        newContent._id = undefined;
        newContent.parentId = targetParentId;
        const parentContent = await this.findById(targetParentId).exec();
        const copiedContent = await this.createContent(newContent, parentContent, userId);

        //create copy content version and content lang
        //TODO: should use promise.all
        copyVersions.forEach(async version => {
            const savedVersion = await this.contentVersionService.createNewVersion(version.toObject() as any, copiedContent._id.toString(), userId, version.language);
            const contentLanguage = this.createContentLanguage(version.toObject() as any, savedVersion._id.toString(), userId, version.language);
            copiedContent.contentLanguages.push(contentLanguage);

        });
        if (copyVersions.length > 0) {
            await copiedContent.save();
        }

        return copiedContent;
    }

    private createCopiedChildrenContent = async (sourceContentId: string, copiedContent: T, userId: string): Promise<any> => {
        //get children
        const children = await this.find({ parentId: sourceContentId } as any, { lean: true }).exec();
        //TODO: should use promise.all
        children.forEach(async childContent => {
            await this.executeCopyContentFlow(childContent._id, copiedContent._id, userId)
        })
    }

    private getDescendants = async (parentId: string): Promise<T[]> => {
        //get source content 
        const parentContent = await this.findById(parentId).exec();
        if (!parentContent) throw new DocumentNotFoundException(parentId);
        if (!parentContent.parentPath) parentContent.parentPath = ',';

        const startWithParentPathRegExp = new RegExp("^" + `${parentContent.parentPath}${parentContent._id},`);
        const conditions = { parentPath: { $regex: startWithParentPathRegExp } };
        return this.find(conditions as any).exec();
    }

    /**
     * Execute Cut content flow
     * @param sourceContentId 
     * @param targetParentId 
     */
    public executeCutContentFlow = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        const cutContent = await this.createCutContent(sourceContentId, targetParentId, userId);

        const cutResult = await this.createCutDescendantsContent(sourceContentId, cutContent);
        return cutContent;
    }

    protected createCutContent = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        //get source content 
        const sourceContent = await this.findById(sourceContentId).exec();
        if (!sourceContent) throw new DocumentNotFoundException(sourceContentId);

        const targetParent = await this.findById(targetParentId).exec();

        Object.assign(sourceContent, this.getNewParentPathAndAncestor(targetParent, sourceContent));
        sourceContent.updatedBy = userId;
        const updatedContent = await sourceContent.save();
        return updatedContent;
    }

    private createCutDescendantsContent = async (sourceContentId: string, cutContent: T): Promise<[T[], any]> => {
        //get descendants of sourceContent
        const descendants = await this.getDescendants(sourceContentId);
        if (descendants.length == 0) return [descendants, null];

        descendants.forEach(childContent => {
            Object.assign(childContent, this.getNewParentPathAndAncestor(cutContent, childContent));
            childContent.updatedBy = cutContent.updatedBy;
        })

        const updateOperators = descendants.map(x => ({
            updateOne: {
                filter: { _id: x._id },
                update: x.toObject()
            }
        }));

        const bulkWriteResult = await this.Model.bulkWrite([updateOperators], { ordered: false });
        return [descendants, bulkWriteResult];
    }

    private getNewParentPathAndAncestor = (newParentContent: T, currentContent: T): { parentId: string, parentPath: string, ancestors: string[] } => {
        const parentId = newParentContent ? newParentContent._id : null;
        const index = parentId ? currentContent.ancestors.findIndex(p => p == parentId) : 0;

        //update parent path, ancestors
        const paths = currentContent.parentPath.split(',').filter(x => x);
        let newPath = newParentContent && newParentContent.parentPath ? newParentContent.parentPath : ',';
        let newAncestors = newParentContent ? newParentContent.ancestors.slice() : [];

        for (let i = index; i < currentContent.ancestors.length; i++) {
            newPath = `${newPath}${paths[i]},`;
            newAncestors.push(currentContent.ancestors[i]);
        }

        return {
            parentPath: newPath,
            ancestors: newAncestors,
            parentId: parentId
        };
    }

    protected mergeToContentLanguage(content: T, contentLang: P): T & P {
        const contentJson: any = content && typeof content.toJSON === 'function' ? content.toJSON() : content;
        const contentLangJson: any = contentLang && typeof contentLang.toJSON === 'function' ? contentLang.toJSON() : contentLang;

        if (contentLangJson && contentLangJson.childItems) {
            const language = contentLangJson.language;
            contentLangJson.childItems.forEach(childItem => {
                const publishedItem = childItem.content?.contentLanguages?.find((cLang: P) => cLang.language === language && cLang.status == VersionStatus.Published) as P;
                childItem.content = this.mergeToContentLanguage(childItem.content, publishedItem);
            });
        }

        const contentLanguageData: T & P = Object.assign(contentLangJson ?? {} as any, contentJson);

        delete contentLanguageData.contentLanguages;
        return contentLanguageData;
    }

    protected mergeToContentVersion(content: T, contentVersion: V): T & V {
        const contentJson = content && typeof content.toJSON === 'function' ? content.toJSON() : content;
        const contentVersionJson: any = contentVersion && typeof contentVersion.toJSON === 'function' ? contentVersion.toJSON() : contentVersion;

        const { _id, ancestors, hasChildren, isDeleted, contentType, masterLanguageId, parentId, parentPath, createdBy } = contentJson as any;

        const contentVersionData: T & V = Object.assign(contentVersionJson ?? {},
            { _id, ancestors, hasChildren, isDeleted, contentType, masterLanguageId, parentId, parentPath, createdBy },
            { versionId: contentVersionJson?._id?.toString() });

        delete contentVersionData.contentLanguages;
        delete contentVersionData.contentId;
        return contentVersionData;
    }
}