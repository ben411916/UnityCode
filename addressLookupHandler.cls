public with sharing class addressLookupHandler {
    static final String PRIVATE_ACCOUNT_PREFIX = '001'; 
    static final String PRIVATE_OPPORTUNITY_PREFIX = '006'; 
    @AuraEnabled
    public static String createAndMapAssociatedLocations(String name,String building_name, String building_number, String street, String city, String postcode, String uprn, String headOfficeValue, String billingAddressValue, String complianceSiteValue, String operationalSiteValue, String recordId){
            Integer locInt = 0;
            locInt = [SELECT count() FROM Location WHERE uprn__c =:uprn];
            Id locId;
            Id accountId;
            String recordIdPrefix = String.valueOf(recordId).substring(0,3);
            if(recordIdPrefix == PRIVATE_ACCOUNT_PREFIX){
                accountId = recordId;
            }
            if(recordIdPrefix == PRIVATE_OPPORTUNITY_PREFIX){
                Opportunity o = [SELECT AccountId FROM Opportunity WHERE id =: recordId];
                accountId = o.accountId;
            }
            if(locInt == 0){
                Schema.Location loc = new Schema.Location();
                loc.Name = name;
                loc.building_name__c = building_name;
                loc.building_number__c = building_number;
                loc.Street__c = street;
                loc.city__c = city;
                loc.Postal_Code__c = postcode;
                loc.UPRN__c=uprn;
                insert loc;
                locId = loc.id;

            }
            if(locInt != 0){
                locId = [SELECT id FROM Location WHERE uprn__c =: uprn LIMIT 1].id;
            }
            return buildAssociatedLocationList(headOfficeValue, billingAddressValue, complianceSiteValue, operationalSiteValue, locId, accountId);
    }

    @AuraEnabled
    public static String editLocation(String name,String building_name, String building_number, String street, String city, String postcode, String uprn, String recordId){
        Schema.Location loc = [SELECT name, building_name__c, building_number__c, Street__c, city__c, Postal_Code__c, UPRN__c FROM Location WHERE id=:recordId LIMIT 1];
        loc.Name = name;
        loc.building_name__c = building_name;
        loc.building_number__c = building_number;
        loc.Street__c = street;
        loc.city__c = city;
        loc.Postal_Code__c = postcode;
        loc.UPRN__c=uprn;
        update loc;
        return 'Location Updated Correctly.';
    }

    public static String buildAssociatedLocationList(String headOfficeValue, String billingAddressValue, String complianceSiteValue, String operationalSiteValue, String locId, String accountId){
        List<AssociatedLocation> assLocToInsert = new List<AssociatedLocation>();
        if(headOfficeValue == 'Yes'){
            Integer headOfficeAmount = [SELECT count() FROM AssociatedLocation WHERE ParentRecordId=:accountId AND Type='Head Office Site'];
            if(headOfficeAmount == 0){
                Schema.AssociatedLocation asLoc = new Schema.AssociatedLocation();
                asLoc.LocationId=locId;
                asLoc.ParentRecordId=accountId;
                asLoc.Type='Head Office Site';
                assLocToInsert.add(asLoc);
            }
            else{
                System.debug('Not added new Head Office as one alreacy exists.');
            }

        }
        if(billingAddressValue == 'Yes'){
            Schema.AssociatedLocation asLoc = new Schema.AssociatedLocation();
            asLoc.LocationId=locId;
            asLoc.ParentRecordId=accountId;
            asLoc.Type='Billing Address Site';
            assLocToInsert.add(asLoc);
        }
        if(complianceSiteValue == 'Yes'){
            Schema.AssociatedLocation asLoc = new Schema.AssociatedLocation();
            asLoc.LocationId=locId;
            asLoc.ParentRecordId=accountId;
            asLoc.Type='Compliance Site';
            assLocToInsert.add(asLoc);
        }
        if(operationalSiteValue == 'Yes'){
            Schema.AssociatedLocation asLoc = new Schema.AssociatedLocation();
            asLoc.LocationId=locId;
            asLoc.ParentRecordId=accountId;
            asLoc.Type='Operational Site';
            assLocToInsert.add(asLoc);
        }
        insert assLocToInsert;
        return 'Location and associated locations inserted correctly.';
    }

}