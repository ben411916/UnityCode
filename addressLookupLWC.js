/**
 * Created by benAllington on 05/08/2022.
 */

 import { LightningElement, track, api, wire } from 'lwc';
 import { ShowToastEvent } from 'lightning/platformShowToastEvent';
 import { updateRecord } from 'lightning/uiRecordApi';   
 
 //apex imports
 import findAddressesGET from '@salesforce/apex/rest_ApexRouter.findAddressFromStringGET';
 import createLocations from '@salesforce/apex/addressLookupHandler.createAndMapAssociatedLocations';
 import editLocation from '@salesforce/apex/addressLookupHandler.editLocation';

 
 //connector
 //import getAddressIo from 'c/getAddressIo'; 
 
 const addressEndpoint = 'https://api-sandbox.addresscloud.com/match/v1/address/geocode?query=';
 const byIdEndpoint = 'https://api-sandbox.addresscloud.com/match/v1/address/lookup/byId/';
 
 const _getResponseError = (response) => {
 
     // handling cases found in getAddress.io error docs
     /**
      * 404: address not found
      * 400: invalid request
      * 401: api key expired
      * 429: daily api request limit exceeded
      * 500: server error from service (according to getAddress, we should never see this.)
      */
 
     let e; 
 
     switch (response.statusText) {
         case 'Not Found': 
             e = new Error('No addresses were found for this post code. Please enter manually.');
             e.name = 'NotFoundError'; // flag this so we can handle 
             break;
         case 'Bad Request': 
             e = new Error('There was an error in the request to the address service. Please contact support to report this. (400)');
             break;
         case 'Unauthorized': 
             e = new Error('The subscription to the address service has lapsed. Please contact support to report this. (401)');
             break; 
         case 'Too Many Requests': 
             e = new Error('The system has exceeded the maximum requests to the address service per day. Please contact support to report this. (429)');
             break; 
         case 'Internal Server Error': 
             e = new Error('There was an failure in the address service. Please contact support. (500)');
             break;
         default: 
             //we should never get here
             e = new Error('An unexpected error condition has occurred. Please contact support.');
             break; 
     }
 
     return e; 
     }
 
 /**
  * ToDo:
  * - [DONE] API Key stored on server
  * - [DONE] handle specific callout failures
  * - [DONE] refactor connection to its own class/module
  * - add in error panel/better visual error handling
  * - veryify handling child event bubbling in parent
  * 
  * Nice To Have:
  * - Investigate post to REST service with api key in header
  */
 export default class AddressLookupLWC extends LightningElement {
 
     // Salesforce recordId allows use in record home
     @api recordId;
     @api editonly = false;
     @api response;
     @api response2;
     @api saveResponse;
     @api error;
     @api isSuccess = false; 
     
     //tracked reactive private props
     parsedJSON = [];
     addresses = [];
     @api mapMarkers;
     finalAddress = '';
     @api organisation = '';
     @api geoLon = '';
     @api geoLat = '';
     @api sub_building = '';
     @api building_name = '';
     @api building_number = '';
     @api primary_street = '';
     @api locality = '';
     @api postcode = '';
     @api uprn = '';
     @api locationPrefix = '131';
     @api visible = false; //used to hide/show dialog
     @api title = 'Save and create associated locations?'; //modal title
     @api name; //reference name of the component
     @api message = ''; //modal message
     @api confirmLabel = 'Yes, Confirm'; //confirm button label
     @api cancelLabel = 'No, Cancel'; //cancel button label
     @api successMessage = 'Associated Locations Created Successfully';
     @api originalMessage; //any event/message/detail to be published back to the parent component
     headOfficeValue = '';
     billingAddressValue = '';
     operationalSiteValue = '';
     complianceSiteValue = '';
     result = [];
     results;

     propertyResult = {};
     propertyResult2 = [];
     allAddresses = [];
     add = [{"label":"2 Morley Road, London E10 6LL","value":"8e194e69c23471f:cJhvjZ"},{"label":"2A Morley Road, London E10 6LL","value":"8e194e69c23471f:FyzioA"}];
     lstOptions = '';
     resultMap = [];
     error;
     stack;
     value = [];
     selectedAddress = '';
     @api selectedId = '';
     searchKey = ''; 
     stringyResult = '';
     matchStatus = '';
     @api picklistVisible = false;
     @api recordVisible = false;
 
     //private props
     latitude; 
     longitude;
     hasRendered = false; 
     connection; 
     response;
 
     // fetch api key from org storagex
     apikey = '';
     
     @track isDialogVisible = false;
     @track originalMessage;
     @track displayMessage = 'Click on the \'Open Confirmation\' button to test the dialog.';
 
     handleClick(event){
        console.log('handleClick');
        if(this.recordId.substring(0,3) != this.locationPrefix){
                this.isDialogVisible = true;
        }
        if(this.recordId.substring(0,3) == this.locationPrefix){
            editLocation({ name: this.building_number + ' ' + this.propertyResult.result.properties.primary_street + ', ' + this.postcode,
                          building_name : this.building_name,
                          building_number : this.building_number,
                          street : this.propertyResult.result.properties.primary_street,
                          city : this.locality,
                          postcode : this.postcode,
                          uprn : this.uprn,
                          recordId : this.recordId

                        })
          .then(result => {
            this.saveResponse = result;
            this.error = undefined;
            this.successMessage = 'Location Address Updated Successfully.';
            this.isSuccess = true;
               
          })
          .catch(error => {
            this.error = error;
            console.log(error);
            this.saveResponse = undefined;
		      })
        }
     }
     handleChangeHeadOffice(event){
      this.headOfficeValue = event.detail.value;
     }
     handleChangeBillingAddress(event){
      this.billingAddressValue = event.detail.value;
     }
     handleChangeOperationalSite(event){
      this.operationalSiteValue = event.detail.value;
     }
     handleChangeComplianceSite(event){
      this.complianceSiteValue = event.detail.value;
     }
     handleSave(event){
      if(this.complianceSiteValue=='No' && this.headOfficeValue=='No' && this.billingAddressValue=='No' && this.operationalSiteValue=='No'){
         alert('All selections cannot be No');
      }
      else{
        this.isLoaded = false;
        createLocations({ name: this.building_number + ' ' + this.propertyResult.result.properties.primary_street + ', ' + this.postcode,
                          building_name : this.building_name,
                          building_number : this.building_number,
                          street : this.propertyResult.result.properties.primary_street,
                          city : this.locality,
                          postcode : this.postcode,
                          uprn : this.uprn,
                          headOfficeValue : this.headOfficeValue,
                          billingAddressValue : this.billingAddressValue,
                          complianceSiteValue :this.complianceSiteValue,
                          operationalSiteValue : this.operationalSiteValue,
                          recordId : this.recordId

                        })
          .then(result => {
            this.saveResponse = result;
            console.log(result);
            this.error = undefined;
            this.isDialogVisible = false;
            this.isSuccess = true;
               
          })
          .catch(error => {
            this.error = error;
            console.log(error);
            this.saveResponse = undefined;
		      })
      }
      }
      handleCancel(event){
          this.isDialogVisible = false;
      }
     
     handleSearchKeyChange(event){
         this.searchKey = event.target.value;
     }
     renderedCallback() {
         if (this.hasRendered) { 
             return; 
         }
         this.hasRendered = true; 
     }
 
     get options1() {
         return [
             { label: 'Yes', value: 'Yes' },
             { label: 'No', value: 'No' },
         ];
     }
     get options2() {
         return [
             { label: 'Yes', value: 'Yes' },
             { label: 'No', value: 'No' },
         ];
     }
     get options3() {
         return [
             { label: 'Yes', value: 'Yes' },
             { label: 'No', value: 'No' },
         ];
     }
     get options4() {
      return [
          { label: 'Yes', value: 'Yes' },
          { label: 'No', value: 'No' },
      ];
  }
  showSuccessToast() {
    const evt = new ShowToastEvent({
        title: 'Success',
        message: 'Save Successful',
        variant: 'success',
        mode: 'dismissable'
    });
    this.dispatchEvent(evt);
}
 
     handleFind(){
         this.error = undefined;
         this.stack = undefined;
         this.picklistVisible = true;
         this.parsedJSON = [];
         this.addresses = [];
         this.response = undefined;
         this.results = undefined;
         findAddressesGET({endPoint : addressEndpoint, enteredText : this.searchKey })
             .then(result => {
             let stringResult = JSON.stringify(result);
             this.response = JSON.parse(stringResult);
             this.results = JSON.stringify(this.response.results);
             var parsedJSON = JSON.parse(this.results);
             
              for (var i=0;i<parsedJSON.length;i++) {
               var item = {
                   "label": parsedJSON[i].description.toString(),
                   "value": parsedJSON[i].id.toString()
               };
               console.log(item);
               this.addresses.push(item);
               console.log(this.addresses);
                 
              }
 
             this.addresses = JSON.stringify(this.addresses);
             this.allAddresses = JSON.parse(this.addresses);
                 })
                 .catch(error => {
                     console.error('Error:', error);
                 });   
 
       
     }
 
     handleAddressChange(event){
         this.error = undefined;
         this.stack = undefined;
         findAddressesGET({endPoint : byIdEndpoint, enteredText : event.target.value })
             .then(result => {
               let stringResult = JSON.stringify(result);
               this.propertyResult = JSON.parse(stringResult);
               this.building_number = this.propertyResult.result.properties.building_number;
               this.primary_street = this.propertyResult.result.properties.primary_street;
               this.locality = this.propertyResult.result.properties.locality;
               this.postcode = this.propertyResult.result.properties.postcode;
               this.uprn = this.propertyResult.result.properties.uprn;
               this.sub_building = this.propertyResult.result.properties.sub_building;
               this.building_name = this.propertyResult.result.properties.building_name;
               this.organisation = this.propertyResult.result.properties.organisation;
               this.geoLat = this.propertyResult.result.geometry.coordinates.lat;
               this.geoLon = this.propertyResult.result.geometry.coordinates.lon;
               this.mapMarkers = [
                     {
                         location: {
                             Latitude: this.geoLat,
                             Longitude: this.geoLon,
                         },
                     },
                 ];
               this.recordVisible = true;
               
             
         })
             .catch(error => {
                     console.error('Error:', error);
                 }); 
      }
 
     get hasRecordId(){
         return this.recordId ? true : false;
     }
 
     get saveable(){
         return !this.hasRecordId;
     }
 
     get hasResults(){
         console.log('result Length ' + this.result.length);
         return this.result.length > 0; 
     }
     handleChange(event) {
         this.lstSelected = event.detail.value;
     }
 
     errorCallback(error, stack){
         this.error = error; 
         this.stack = stack; 
     }
 
 
 }