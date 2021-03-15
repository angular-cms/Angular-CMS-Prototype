import { Inject, Injectable, InjectionToken } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { groupBy } from '../../helpers/common';
import { ClassOf, TypeOfContent } from '../../types';
import { ContentReference } from '../../types/content-reference';
import { PaginateOptions, QueryResult, QuerySort } from '../base.model';
import { ContentService } from './content.service';
import { ContentData } from './models/content-data';
import { Content, FilterContent } from './models/content.model';

/**
 * The loader options for `ContentLoader`
 *
 * @member contentType name of Content Type or class of Content Type such as 'ArticlePage' or `ArticlePage`
 * @member language the language of content, if not provided the default language will be used
 * @member pageNumber the page number
 * @member pageSize the page size
 */
export type LoaderOptions = {
    /**
     * name of Content Type or class of Content Type such as `'ArticlePage'` or `ArticlePage`
     */
    contentType?: string | ClassOf<any>;
    /**
     * the language of content, if not provided the default language will be used
     */
    language?: string;
    /**
     * the page number
     */
    pageNumber?: number;
    /**
     * the page size
     */
    pageSize?: number
};

export const CONTENT_SERVICE_PROVIDER: InjectionToken<ContentService<Content>[]> = new InjectionToken<ContentService<Content>[]>('CONTENT_SERVICE_PROVIDER');

@Injectable({ providedIn: 'root' })
export class ContentLoader {
    constructor(private contentServiceResolver: ContentServiceResolver) { }

    get<T extends ContentData>(contentLink: ContentReference, language?: string): Observable<T> {
        const contentService = this.contentServiceResolver.resolveContentProviderFactory(contentLink.type);
        return contentService.getContent(contentLink.id, language).pipe(
            map((content: Content) => contentService.getContentData(content))
        );
    }

    getChildren<T extends ContentData>(contentLink: ContentReference, language?: string, select?: string, loaderOptions?: LoaderOptions): Observable<T[]> {
        const contentService = this.contentServiceResolver.resolveContentProviderFactory(contentLink.type);
        return contentService.getContentChildren(contentLink.id, language, select).pipe(
            map((children: Content[]) => children.map(childContent => contentService.getContentData(childContent)))
        );
    }

    getDescendents(contentLink: ContentReference, loaderOptions?: LoaderOptions): Observable<ContentData[]> {
        const filter: FilterContent = {
            type: contentLink.type,
            parentPath: { $regex: `,${contentLink.id},` }
        };
        const project = {
            _id: 1,
            contentType: 1,
            versionId: 1
        };
        return this.query<ContentData>(filter, project).pipe(
            map((result: QueryResult<ContentData>) => result.docs)
        );
    }

    getAncestors(contentLink: ContentReference, language?: string, select?: string, loaderOptions?: LoaderOptions): Observable<ContentData[]> {
        const contentService = this.contentServiceResolver.resolveContentProviderFactory(contentLink.type);
        return contentService.getAncestors(contentLink.id, language, select).pipe(
            map((ancestors: Content[]) => ancestors.map(content => contentService.getContentData(content)))
        );
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
    query<T extends ContentData>(
        filter: FilterContent,
        project?: string | { [key: string]: any },
        sort?: string | QuerySort,
        page?: number,
        limit?: number): Observable<QueryResult<T>> {
        const contentService = this.contentServiceResolver.resolveContentProviderFactory(filter.type);
        return contentService.queryContents(filter, project, sort, page, limit).pipe(
            map((result: QueryResult<Content>) =>
                Object.assign(result, { docs: result.docs.map(childContent => contentService.getContentData(childContent)) })
            ));
    }

    getItems(contentLinks: ContentReference[], language?: string, statuses?: number[], isDeepPopulate?: boolean): Observable<Content[]> {

        const contentLinksGroup = groupBy(contentLinks, 'type');
        const getContentItemsArray: Observable<Content[]>[] = [];
        Object.keys(contentLinksGroup).forEach(key => {
            const contentService = this.contentServiceResolver.resolveContentProviderFactory(key);
            const contentIds = contentLinksGroup[key].map(x => x._id);
            if (contentService && contentIds && contentIds.length > 0) {
                getContentItemsArray.push(
                    contentService.getContentItems(contentIds, language, statuses, isDeepPopulate).pipe(catchError(() => []))
                );
            }
        });

        return forkJoin(...getContentItemsArray).pipe(
            map((contentsResult: Content[][]) => {
                let result: Content[] = [];
                contentsResult.forEach(contents => result = result.concat(contents));
                return result;
            })
        );
    }
}

@Injectable({
    providedIn: 'root'
})
export class ContentServiceResolver {
    constructor(@Inject(CONTENT_SERVICE_PROVIDER) private contentServices: ContentService<Content>[]) { }

    resolveContentProviderFactory(typeOfContent: TypeOfContent): ContentService<Content> {

        const resolvedService = this.contentServices.find(x => x.isMatching(typeOfContent));
        if (resolvedService) { return resolvedService; }

        throw new Error(`The CMS can not resolve the Content Service for the content has type of ${typeOfContent}`);
    }
}
