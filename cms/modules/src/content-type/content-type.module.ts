import { CommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { CmsTableModule } from '../shared/table/table.module';
import { ContentTypeListComponent } from './content-type-list.component';
import { ContentTypeDetailComponent } from './content-type-detail.component';
import { Routes, RouterModule } from '@angular/router';
import { ADMIN_ROUTES, ADMIN_WIDGETS, CmsWidgetPosition, CoreModule } from '@typijs/core';

const contentTypeRoutes: Routes = [
    { path: `content-type/page/:name`, component: ContentTypeDetailComponent },
    { path: `content-type/block/:name`, component: ContentTypeDetailComponent },
    { path: `content-type/media/:name`, component: ContentTypeDetailComponent }
];

@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        CoreModule,
        CmsTableModule
    ],
    declarations: [ContentTypeDetailComponent, ContentTypeListComponent]
})
export class ContentTypeModule {
    static forRoot(): ModuleWithProviders<ContentTypeModule> {
        return {
            ngModule: ContentTypeModule,
            providers: [
                { provide: ADMIN_ROUTES, useValue: contentTypeRoutes, multi: true },
                {
                    provide: ADMIN_WIDGETS, useValue: {
                        component: ContentTypeListComponent,
                        position: CmsWidgetPosition.Left,
                        group: 'Content Type',
                        order: 10
                    },
                    multi: true
                }
            ]
        };
    }
}
