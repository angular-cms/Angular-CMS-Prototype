import { Component } from '@angular/core';

import { CmsProperty } from '@typijs/core';

@Component({
    selector: '[imageReferenceProperty]',
    template: `
    <div class="form-group row" [formGroup]="formGroup">
        <label [attr.for]="id" class="col-3 col-form-label">{{label}}</label>
        <div class="col-5">
            <image-reference [formControlName]="propertyName"></image-reference>
        </div>
    </div>
  `
})
export class ImageReferenceProperty extends CmsProperty { }
