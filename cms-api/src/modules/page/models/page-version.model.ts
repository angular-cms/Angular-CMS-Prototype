import * as mongoose from 'mongoose';
import { ContentVersionSchema, IContentVersion, IContentVersionDocument, IContentVersionModel } from '../../content/content.model';
import { cmsPage, cmsPageVersion } from './page.model';

export interface IPageVersion extends IContentVersion {
    urlSegment: string;
    simpleAddress: string;
    linkUrl: string;
    visibleInMenu: boolean;
}
export interface IPageVersionDocument extends IPageVersion, IContentVersionDocument { }
export interface IPageVersionModel extends IContentVersionModel<IPageVersionDocument> { }
export const PageVersionSchema = new mongoose.Schema<IPageVersionDocument, IPageVersionModel>({
    ...ContentVersionSchema.obj,
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: cmsPage, required: true },
    masterVersionId: { type: mongoose.Schema.Types.ObjectId, ref: cmsPageVersion },
    urlSegment: { type: String, required: true },
    simpleAddress: { type: String, required: false, lowercase: true, trim: true },
    visibleInMenu: { type: Boolean, required: true, default: false },
}, { timestamps: true });

export const PageVersionModel: IPageVersionModel = mongoose.model<IPageVersionDocument, IPageVersionModel>(cmsPageVersion, PageVersionSchema);