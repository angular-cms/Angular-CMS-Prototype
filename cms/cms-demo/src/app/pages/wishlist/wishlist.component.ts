import { CmsComponent, PageService } from '@typijs/core';
import { Component } from '@angular/core';
import { WishlistPage } from './wishlist.pagetype';

@Component({
    templateUrl: 'wishlist.component.html'
})
export class WishlistComponent extends CmsComponent<WishlistPage> {
    constructor(private contentService: PageService) {
        super();
    }
}
