import { Provider } from 'injection-js';
import { MediaController } from './media.controller';
import { MediaRouter } from './media.route';
import { MediaService, MediaVersionService } from './media.service';
import { Multer } from './multer';
import { CmsStorageEngine, diskStorage, ImgurStorageEngine } from './storage';

const MediaProviders: Provider[] = [MediaService, MediaVersionService, MediaController, MediaRouter, Multer]
const StorageProviders: Provider[] = [ImgurStorageEngine, { provide: CmsStorageEngine, useValue: diskStorage }]

export { MediaService, MediaVersionService, MediaController, MediaRouter, Multer, MediaProviders, StorageProviders };
export * from './storage';
