import { BlockData, BlockType, Property, CmsImage, UIHint, UrlItem } from '@angular-cms/core';
import { CategoryContainerComponent } from './category-container.component';

@BlockType({
    displayName: 'Category Container Block',
    groupName: 'Category',
    componentRef: CategoryContainerComponent
})
export class CategoryContainerBlock extends BlockData {

    @Property({
        displayName: 'Heading',
        displayType: UIHint.Text
    })
    heading: string;

    @Property({
        displayName: 'Subheading',
        displayType: UIHint.Textarea
    })
    subheading: string;

    @Property({
        displayName: 'Background Image',
        displayType: UIHint.Image
    })
    image: CmsImage;

    @Property({
        displayName: 'Link',
        displayType: UIHint.Url
    })
    link: UrlItem;

    @Property({
        displayName: 'Left Categories',
        displayType: UIHint.ContentArea,
        allowedTypes: ['CategoryBlock']
    })
    leftCategories: any[];

    @Property({
        displayName: 'Right Categories',
        displayType: UIHint.ContentArea,
        allowedTypes: ['CategoryBlock']
    })
    rightCategories: any[];
}
