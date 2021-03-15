import * as mongoose from 'mongoose';
import { ContentLanguageSchema, ContentSchema, IContentDocument, IContentLanguageDocument, IContentModel } from '../../content/content.model';

export const cmsBlock = 'cms_Block';
export const cmsBlockVersion = 'cms_BlockVersion'

export interface IBlockLanguageDocument extends IContentLanguageDocument { }

export const BlockLanguageSchema = new mongoose.Schema({
  ...ContentLanguageSchema.obj,
  versionId: { type: mongoose.Schema.Types.ObjectId, ref: cmsBlockVersion },
}, { timestamps: true });

export interface IBlockDocument extends IContentDocument {
  contentLanguages: Partial<IBlockLanguageDocument>[];
}
export interface IBlockModel extends IContentModel<IBlockDocument> { }

export const BlockSchema = new mongoose.Schema<IBlockDocument, IBlockModel>({
  ...ContentSchema.obj,
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: cmsBlock },
  contentLanguages: [BlockLanguageSchema]
}, { timestamps: true });

export const BlockModel: IBlockModel = mongoose.model<IBlockDocument, IBlockModel>(cmsBlock, BlockSchema);



