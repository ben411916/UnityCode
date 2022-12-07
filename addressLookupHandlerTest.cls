@isTest
private class addressLookupHandlerTest {
    @isTest
    static void createAndMapAssociatedLocationsTest() {
        Account acc = (Account)TestDataFactory.createSObject('Account');
        Opportunity opp = (Opportunity)TestDataFactory.createSObject('Opportunity', new Map<String,Object>{
            'AccountId' => acc.id
          });
          Test.startTest();
          addressLookupHandler.createAndMapAssociatedLocations('test name','building house','22A', 'happy valley', 'London', 'E106LL', '12356123', 'Yes', 'Yes', 'Yes', 'No',acc.id);
          addressLookupHandler.createAndMapAssociatedLocations('test name','building house','22A', 'happy valley', 'London', 'E106LL', '12356123', 'Yes', 'No', 'No', 'Yes',opp.id);
          System.assertEquals(acc.id, opp.AccountId);
          Test.stopTest();



    }

    @isTest
    static void EditLocations() {
        Account acc = (Account)TestDataFactory.createSObject('Account');
        addressLookupHandler.createAndMapAssociatedLocations('test name','building house','22A', 'happy valley', 'London', 'E106LL', '12356123', 'Yes', 'No', 'No', 'No',acc.id);
        Schema.AssociatedLocation assloc = new Schema.AssociatedLocation();
        assloc = [SELECT id, LocationId FROM AssociatedLocation WHERE ParentRecordId=:acc.id LIMIT 1];
        Test.startTest();
        String s = addressLookupHandler.editLocation('test nameUpdate', 'building house','22A', 'happy valley', 'London', 'E106LL', '12356123', assLoc.LocationId);
        Schema.Location loc = [SELECT id, Name FROM Location WHERE id=:assLoc.LocationId LIMIT 1];
        System.assertEquals('test nameUpdate',loc.Name);
        System.assertEquals('Location Updated Correctly.', s);
        Test.stopTest();
    }
}
