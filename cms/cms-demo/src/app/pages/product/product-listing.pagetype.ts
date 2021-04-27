import { PageType, Property, UIHint } from '@typijs/core';
import { StandardPage } from '../standard/standard.pagetype';
import { ProductListingComponent } from './product-listing.component';

@PageType({
    displayName: 'Product Listing Page',
    componentRef: ProductListingComponent,
    description: 'This is product listing page'
})
export class ProductListingPage extends StandardPage {

    @Property({
        displayName: 'Number Items Per Page',
        displayType: UIHint.Text
    })
    numberItemsPerPage: string;
}
