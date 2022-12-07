/***********************************************************
****    @author:     Sanket Supe
****    @company:    NHS
****    @Date:       16/09/2020 - Created.
                     25/03/2021 Update AM
************************************************************/
import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation'; 
import getCustomMeta from '@salesforce/apex/NHS_ECD_ProfanityFilterAndSanityCheck.getCustomMeta';

import { registerListener, unregisterListener, fireEvent } from 'c/pubsub';

import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import { FlowContextProvider } from 'c/nhsFlowContextProvider';

import { scrollToElement, getGridSize, getSanitizedData } from 'c/nhsUtils';
const ERROR_MESSAGE_DEFAULT = 'Enter some text';
const PAGE_ERROR_INPUT_TYPE = 'inputGroup';
const INVALID_CHARACTERS = 'Your message must not include special characters, like / # £ : ; or %';
const TOO_MANY_CHARACTERS = 'Your message must not be more than 32,000 characters';

const FLOW_VALIDATION_RESP_EVENT_NAME = '@salesforce/messageChannel/LMSFlowValidationResponse__c';
const FLOW_VALIDATION_REQ_EVENT_NAME = '@salesforce/messageChannel/LMSFlowValidationRequest__c';
const SCROLL_TO_EVENT_NAME = '@salesforce/messageChannel/LMSFlowScrollToRequest__c';
const DISPLAYELEMENT_INPUTELEMENT_CONNECTION = '@salesforce/messageChannel/LMSDisplayToInputConnection__c';

const FORM_GROUP_CSS_STANDARD = 'nhsuk-form-group';
const FORM_GROUP_CSS_STANDARD_ERROR = 'nhsuk-form-group nhsuk-form-group--error';

const INPUT_CSS_ERROR = ' nhsuk-textarea--error';
const INPUT_CSS_STANDARD = 'nhsuk-textarea';

const ERROR_MESSAGE_RETRIEVE_METADATA = 'NhsInputTextAreaElement:connectedCallback - could not get metadata values due to ';

export default class NhsInputTextAreaElement extends LightningElement {
    inputGroupId;
    scrollToSubscription = undefined; 

    @api titleText;
    @api hint1Text;
    @api labelText;
    @api hintLabelText;
    @api requiredField;
    @api customErrorMessage;
    @api rows;
    @api enteredValue;

    @api labelForSummary;
    @api dependentValueForSummary;
    @api dependentLabelForSummary;
    @api requiredInSummary;
    @api sortOrderNumber;
    @api profanityCheck;
    @api inputSanitisation;
    @api identifier;

    @track pageErrors = [];
    @track enteredText = null; 
    @track invalidCharacters = false;
    @track profanityDetected = false;
    @track objMetadataValues = {};

    isSubscribedToValidationRequestEvent = false;
    handleValidationRequest;
    isSubscribedToConnectionRequestEvent = false;
    handleConnectionRequest;

    isSubscribedToScrollToEvent = false;
    handleScrollTo;

    @wire(CurrentPageReference) pageRef;
   
    formGroupCSS = FORM_GROUP_CSS_STANDARD;
    inputClass = INPUT_CSS_STANDARD;
    
    connectedCallback() {
        this.handleSubscribe();
        this.subscribeScrollTo();
        if(this.identifier){
            this.handleLWCConnectionSubscribe();
        }

        if(this.requiredField == null || !this.requiredField){
            this.requiredField = false;
        }
        if(this.customErrorMessage == null || !this.customErrorMessage){
            this.customErrorMessage = ERROR_MESSAGE_DEFAULT;
        }

        if(this.profanityCheck || this.inputSanitisation){
            this.getCustomMetaProfanitySanity();
        }
    }

    renderedCallback(){
        if(!this.identifier){
            if(this.labelText){
                var labelId = this.template.querySelector('.nhsuk-label').id;
                this.template.querySelector('textarea').setAttribute('aria-labelledby', labelId);
            } 
            if(this.titleText && !this.labelText){
                var labelId = this.template.querySelector('.nhsuk-label--m').id;
                this.template.querySelector('textarea').setAttribute('aria-labelledby', labelId);
            }
        }
        if(this.hasHint1){
            var hintId = this.template.querySelector('.nhsuk-select-hint').id;
            var getElementId = this.template.querySelector('textarea');
            var getAriadescribedbyId = getElementId.getAttribute('aria-describedby');
            var ariadescribedbyId = getAriadescribedbyId == null ? hintId : getAriadescribedbyId.includes(hintId) ? getAriadescribedbyId :  hintId + ' ' + getAriadescribedbyId;
            this.template.querySelector('textarea').setAttribute('aria-describedby', ariadescribedbyId);        
        }

        if(this.hasHintLabel){
            var hintId = this.template.querySelector('.nhsuk-select-hint-label').id;
            var getElementId = this.template.querySelector('textarea');
            var getAriadescribedbyId = getElementId.getAttribute('aria-describedby');
            var ariadescribedbyId = getAriadescribedbyId == null ? hintId : getAriadescribedbyId.includes(hintId) ? getAriadescribedbyId :  hintId + ' ' + getAriadescribedbyId;
            this.template.querySelector('textarea').setAttribute('aria-describedby', ariadescribedbyId);
        }
    }

    disconnectedCallback(){
        this.unsubscribeLMS();
        this.unsubscribeScrollTo();
        this.handleLWCConnectionUnsubscribe();
    }

    getCustomMetaProfanitySanity(){
        getCustomMeta().then(data => {
            let currentData = data;
            this.objMetadataValues = {           
                ProfanityWordsList: currentData.ProfanityWordsList__c,
                regexPattern: currentData.regex_pattern_frontend__c
            }
        }).catch(error => {
            console.error(ERROR_MESSAGE_RETRIEVE_METADATA + JSON.stringify(error));
        })
    }

    handleSubscribe() {
        if (this.isSubscribedToValidationRequestEvent) return;

        registerListener(FLOW_VALIDATION_REQ_EVENT_NAME, this.handleValidationRequest = (message) => {

            if(message.requestValidation){               
                this.isComponentValid();
            }
        }, this);

        this.isSubscribedToValidationRequestEvent = true;
    }

    subscribeScrollTo() {
        if (this.isSubscribedToScrollToEvent) return;

        registerListener(SCROLL_TO_EVENT_NAME, this.handleScrollTo = (message) => {
            if(message.targetId) {
                scrollToElement(this, message.targetId);
            }}, this);
        this.isSubscribedToScrollToEvent = true;
    }
    handleLWCConnectionSubscribe() {
        if (this.isSubscribedToConnectionRequestEvent) return;
        registerListener(DISPLAYELEMENT_INPUTELEMENT_CONNECTION, this.handleConnectionRequest = (message) => {
            if(message.identifier && message.identifier.includes(this.identifier)){  
                this.template.querySelector('textarea').setAttribute('aria-labelledby', message.identifier);   
            }
        }, this);
        this.isSubscribedToConnectionRequestEvent = true;
    }

    unsubscribeLMS(){
        if (this.isSubscribedToValidationRequestEvent) {
           unregisterListener(FLOW_VALIDATION_REQ_EVENT_NAME, this.handleValidationRequest, this);
           this.isSubscribedToValidationRequestEvent = false;
        }
     }
     
    unsubscribeScrollTo () {
        if (this.isSubscribedToScrollToEvent) {
            unregisterListener(SCROLL_TO_EVENT_NAME, this.scrollToHandler, this);
            this.isSubscribedToScrollToEvent = false;
        }
    }
    handleLWCConnectionUnsubscribe(){
        if (this.isSubscribedToConnectionRequestEvent) {
            unregisterListener(DISPLAYELEMENT_INPUTELEMENT_CONNECTION, this.handleConnectionRequest, this);
            this.isSubscribedToConnectionRequestEvent = false;
        }
    }

    textChange(event){
        this.invalidCharacters=false;
        this.profanityDetected=false;
        var enteredVal = event.target.value;
        var expression=/[^'"´ A-Za-zÀ-ÖØ-öø-ÿ0-9.,!?()\n@-]/;    
        
        //console.log(this.enteredVal);
        var re = new RegExp(expression);  //&‘’“”
        enteredVal = enteredVal.replaceAll('&','and');
        enteredVal = enteredVal.replaceAll('‘',"'");
        enteredVal = enteredVal.replaceAll('’',"'");
        enteredVal = enteredVal.replaceAll('“','"');
        enteredVal = enteredVal.replaceAll('”','"');
        enteredVal = enteredVal.replaceAll('"','"');
        //console.log(enteredVal);
        if(this.inputSanitisation && re.test(enteredVal)){
            this.invalidCharacters=true;
        }
      
        if(this.profanityCheck){ 
            var profanity_list= this.objMetadataValues.ProfanityWordsList.replace(/\s+/g,"").replace(/(\r\n|\n|\r)/gm,"");            
            var profanity_words_arr=profanity_list.split(",");
            
            String.prototype.contains = function(str) { 
                return this.indexOf(str) != -1; 
            };

            for (var i = 0; i < profanity_words_arr.length; i++) {
                if(enteredVal.toLowerCase().contains(profanity_words_arr[i].toLowerCase())){                    
                    this.profanityDetected=true;
                    break;
                }
            }
        }

        if (!enteredVal || enteredVal.trim() === '') {
            enteredVal = null;
        }
        else {
            enteredVal = enteredVal.trim();
        }

        this.enteredText = getSanitizedData(enteredVal);
        const attributeChangeEvent = FlowAttributeChangeEvent('enteredValue', this.enteredText);
        this.dispatchEvent(attributeChangeEvent);
    }

    get getGridClass() {
        return getGridSize();
    }

    get hasHint1() {
        return (this.hint1Text !== undefined && this.hint1Text !== '' && this.hint1Text !== null);
    }

    get hasHintLabel() {
        return (this.hintLabelText !== undefined && this.hintLabelText !== '' && this.hintLabelText !== null);
    }

    get titleText1() {
        return (this.titleText !== undefined && this.titleText !== '' && this.titleText !== null);
    }

    get customErrorDetail() {
        if(this.pageErrors && this.pageErrors.length > 0) {
            for (var i = 0; i < this.pageErrors.length; i++) {
                const pageError = this.pageErrors[i];
                if (pageError.target === PAGE_ERROR_INPUT_TYPE) {
                    return pageError.detail;
                }
            }
        }
        return undefined;
    } 

    //dynamic id of the input field
    get inputsId(){
        if(!this.inputGroupId){
            if(this.titleText != null){
                this.inputGroupId = "inputId-" + this.titleText.replace(" ", "-");
            } else if(this.hint1Text != null){
                this.inputGroupId = "inputId-" + this.hint1Text.replace(" ", "-");
            } else {
                this.inputGroupId = "input-" + Math.floor(Math.random() * 1000000);
            }        
        }        
        return this.inputGroupId;
    }
     //dynamic id of div
    get inputsDivId(){
        if(!this.selectDivId){
            if(this.titleText != null){
                this.selectDivId = "inputsDivId-" + this.titleText.replace(" ", "-");
            }
            else if(this.hint1Text != null){
                this.selectDivId = "inputsDivId-" + this.hint1Text.replace(" ", "-");                
            }
        } 
        return this.selectDivId;
    }
    
    isComponentValid(){
        this.pageErrors = [];
        const payload = {
            source: "Component",
            isValid: true,
            errorMessage: null
        };
        //console.log(this.enteredText);
        if(this.enteredText == null)
        {this.enteredText = '';}
        
        
        this.enteredText = this.enteredText.replaceAll('&','and');
        this.enteredText = this.enteredText.replaceAll('‘',"'");
        this.enteredText = this.enteredText.replaceAll('’',"'");
        this.enteredText = this.enteredText.replaceAll('“','"');
        this.enteredText = this.enteredText.replaceAll('”','"');
        if(this.profanityDetected){
            payload.isValid = false;            
            var element = this.template.querySelector('textarea.nhsuk-textarea');            
            payload.errorMessage = {key: this.inputGroupId, target: element.id, detail: INVALID_CHARACTERS};
            this.formGroupCSS = FORM_GROUP_CSS_STANDARD_ERROR;
            this.inputClass = INPUT_CSS_STANDARD + INPUT_CSS_ERROR;

            this.pageErrors = [];            
            this.pageErrors.push({key: 1, target: PAGE_ERROR_INPUT_TYPE, detail:  INVALID_CHARACTERS})            
        } else if(this.invalidCharacters){
            payload.isValid = false;            
            var element = this.template.querySelector('textarea.nhsuk-textarea');
            payload.errorMessage = {key: this.inputGroupId, target: element.id, detail: INVALID_CHARACTERS};
            this.formGroupCSS = FORM_GROUP_CSS_STANDARD_ERROR;
            this.inputClass = INPUT_CSS_STANDARD + INPUT_CSS_ERROR;

            this.pageErrors = [];            
            this.pageErrors.push({key: 1, target: PAGE_ERROR_INPUT_TYPE, detail:  INVALID_CHARACTERS})            
        } else if(this.enteredText == '' && this.requiredField === true){
            payload.isValid = false;            
            var element = this.template.querySelector('textarea.nhsuk-textarea');
            payload.errorMessage = {key: this.inputGroupId, target: element.id, detail: this.customErrorMessage};
            this.formGroupCSS = FORM_GROUP_CSS_STANDARD_ERROR;
            this.inputClass = INPUT_CSS_STANDARD + INPUT_CSS_ERROR;

            this.pageErrors = [];            
            this.pageErrors.push({key: 1, target: PAGE_ERROR_INPUT_TYPE, detail: this.customErrorMessage})            
        } else if(this.enteredText!=null){
        if(this.enteredText.length >= 32000){
            console.log(this.enteredText.length);
            payload.isValid = false;            
            var element = this.template.querySelector('textarea.nhsuk-textarea');
            payload.errorMessage = {key: this.inputGroupId, target: element.id, detail: TOO_MANY_CHARACTERS};
            this.formGroupCSS = FORM_GROUP_CSS_STANDARD_ERROR;
            this.inputClass = INPUT_CSS_STANDARD + INPUT_CSS_ERROR;

            this.pageErrors = [];            
            this.pageErrors.push({key: 1, target: PAGE_ERROR_INPUT_TYPE, detail:  TOO_MANY_CHARACTERS})
        }
    }
        else {
            this.formGroupCSS = FORM_GROUP_CSS_STANDARD;
            this.inputClass = INPUT_CSS_STANDARD;
            
            this.enteredValue = this.enteredText
            if(this.requiredInSummary){
                FlowContextProvider.addSummaryItem({
                    sortOrder : this.sortOrderNumber,
                    label : this.labelForSummary,
                    value : this.enteredValue,
                    dependentLabel : this.dependentLabelForSummary,
                    dependentValue : this.dependentValueForSummary
                });
            }
        }

        fireEvent(this.pageRef, FLOW_VALIDATION_RESP_EVENT_NAME, payload); 
        
    }  
}