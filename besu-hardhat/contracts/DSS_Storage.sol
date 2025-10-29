// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DSS Storage
 * @dev This contract manages the storage, addition, update, and deletion of geospatial data chunks,
 * utilizing geohash for spatial indexing. It allows for efficient data retrieval and manipulation
 * based on geohash, height interval, and time interval.
 */
contract DSS_Storage {
    
    /* EVENTS */

    /// @dev Emitted when a new data chunk is added.
    event DataAdded(uint indexed id, string geohash, address indexed addedBy);
    /// @dev Emitted when existing data chunk is updated.
    event DataUpdated(uint indexed id, string geohash, address indexed updatedBy);
    /// @dev Emitted when a data chunk is deleted.
    event DataDeleted(uint indexed id, string geohash, address indexed deletedBy);


    /* STRUCTS */

    /// @dev Represents a height interval with minimum and maximum bounds.
    struct HeightInterval {
        uint min;
        uint max;
    }

    /// @dev Represents a time interval with start and end times.
    struct TimeInterval {
        uint start; // UTC timestamp for interval start.
        uint end;   // UTC timestamp for interval end.
    }

    /// @dev Contains resource information including URL, entity number, and an identifier.
    struct ResourceInfo {
        string url;
        uint entityNumber;
        uint id; // Must be greater than 0.
    }

    /// @dev Represents the core data of an Operational Intent Reference (OIR).
    /// Note: The complete OIR includes this data + geohashes stored in idToGeohash mapping.
    struct OIRData {
        address addedBy; // Address of the user who added the OIR.
        HeightInterval height;
        TimeInterval time;
        ResourceInfo resourceInfo;
    }


    /* STATE VARIABLES */

    /// @dev Maps an ID to its OIR data (stored once per ID).
    mapping(uint => OIRData) public idToData;
    /// @dev Maps an ID to an array of geohashes.
    mapping(uint => string[]) public idToGeohash;
    /// @dev Maps a geohash to an array of IDs (instead of full OIRData array).
    mapping(string => uint[]) public geohashToIds;
    /// @dev Tracks which addresses are allowed to perform certain operations.
    mapping(address => bool) public allowedUsers;
    /// @dev Stores the address of the contract owner.
    address public owner;


    /* MODIFIERS */

    /// @dev Ensures that only allowed users can call a function.
    modifier onlyAllowed() {
        require(allowedUsers[msg.sender], "User not allowed");
        _;
    }

    /// @dev Ensures that only the owner can call a function.
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    /// @dev Ensures that only the creator/owner of a specific OIR can modify it.
    /// @param _id The ID of the OIR to check ownership for.
    modifier onlyOIROwner(uint _id) {
        require(idToData[_id].addedBy == msg.sender, "Not the owner of this OIR");
        _;
    }


    /* FUNCTIONS */

    /**
     * @dev Constructor that initializes the contract.
     * Sets the deployer as the owner and adds them to the allowedUsers list.
     * This ensures the deployer can immediately start adding OIRs.
     */
    constructor() {
        owner = msg.sender;
        allowUser(owner);
    }

    /**
     * @dev Grants a user permission to add, update, and delete OIRs.
     * @param _user The address to grant permissions to.
     * @custom:modifier onlyOwner Only the contract owner can call this function.
     */
    function allowUser(address _user) public onlyOwner {
        allowedUsers[_user] = true;
    }

    /**
     * @dev Revokes a user's permission to interact with OIRs.
     * @param _user The address to revoke permissions from.
     * @custom:modifier onlyOwner Only the contract owner can call this function.
     */
    function disallowUser(address _user) public onlyOwner {
        allowedUsers[_user] = false;
    }

    /**
     * @dev Transfers contract ownership to a new address.
     * The new owner will have full control over user permissions.
     * @param _newOwner The address of the new owner.
     * @custom:modifier onlyOwner Only the current owner can transfer ownership.
     */
    function changeOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }


    /* UPSERT */

    /**
     * @dev Adds or updates an OIR (Operational Intent Reference), represented as a set of geohashes.
     * 
     * This function performs intelligent upsert logic:
     * - If the ID is new: inserts the OIR data into all specified geohashes.
     * - If the ID exists: updates the OIR data and manages geohash associations.
     *   - Geohashes that exist in both old and new lists are updated.
     *   - New geohashes are added.
     *   - Old geohashes not in the new list are removed.
     * 
     * Ownership is automatically checked for existing OIRs via the onlyOIROwner modifier.
     * 
     * @param _geohashes Array of geohash strings representing the spatial coverage of the OIR.
     * @param _minHeight Minimum height/altitude in the vertical interval (e.g., meters).
     * @param _maxHeight Maximum height/altitude in the vertical interval (e.g., meters).
     * @param _startTime Start timestamp (UNIX time) of the temporal interval.
     * @param _endTime End timestamp (UNIX time) of the temporal interval.
     * @param _url URL pointing to detailed OIR information.
     * @param _entity Entity number/identifier associated with this OIR.
     * @param _id Unique identifier for this OIR (must be > 0).
     * 
     * @custom:modifier onlyAllowed Only allowed users can call this function.
     * @custom:modifier onlyOIROwner (conditional) If ID exists, only the original creator can update it.
     * 
     * @custom:throws "No geohashes provided" if _geohashes array is empty.
     * @custom:throws "Invalid height interval" if _maxHeight < _minHeight.
     * @custom:throws "Invalid time interval" if _startTime >= _endTime.
     * @custom:throws "Not the owner of this OIR" if trying to update someone else's OIR.
     */
    function upsertOIR (
        string[] memory _geohashes,
        uint _minHeight,
        uint _maxHeight,
        uint _startTime,
        uint _endTime,
        string memory _url,
        uint _entity,
        uint _id
    ) 
        public onlyAllowed
    {
        require(_geohashes.length > 0, "No geohashes provided");
        require(_maxHeight >= _minHeight, "Invalid height interval");
        require(_startTime < _endTime, "Invalid time interval");

        // Check ownership if OIR already exists
        if (idToGeohash[_id].length > 0) {
            require(idToData[_id].addedBy == msg.sender, "Not the owner of this OIR");
        }

        // Create a new OIRData object with the provided data.
        HeightInterval memory height = HeightInterval({min: _minHeight, max: _maxHeight});
        TimeInterval memory time = TimeInterval({start: _startTime, end: _endTime});
        ResourceInfo memory resourceInfo = ResourceInfo({url: _url, entityNumber: _entity, id: _id});
        OIRData memory newOIR = OIRData({
            addedBy: msg.sender,
            height: height,
            time: time,
            resourceInfo: resourceInfo
        });

        // Maps old geohashes for the given id to update and delete as necessary.
        string[] memory oldGeohashes = idToGeohash[_id];
        bool[] memory oldGeohashesUpdated = new bool[](oldGeohashes.length);

        // Iterates over each new geohash provided in the input to add or update polygon data.
        for (uint i = 0; i < _geohashes.length; i++) {
            string memory currentNewGeohash = _geohashes[i];
            bool exists = false; // Flag to check if the current geohash already exists in old geohashes.

            // Checks if the current geohash exists in the array of old geohashes.
            // If it exists, update the corresponding OIR.
            for (uint j = 0; j < oldGeohashes.length; j++) {
                if (keccak256(abi.encodePacked(currentNewGeohash)) == keccak256(abi.encodePacked(oldGeohashes[j]))) {
                    exists = true; // Marks that the current new geohash exists in old geohashes.
                    oldGeohashesUpdated[j] = true; // Marks this geohash as updated in the tracking array.

                    // Calls updateOIRData to update the existing OIR with the new data.
                    updateOIRData(currentNewGeohash, newOIR);
                    break; // Breaks the loop since the update is done.
                }
            }

            // If the current new geohash does not exist in the old geohashes, insert it as new data.
            if (!exists) {
                addOIRToGeohash(currentNewGeohash, newOIR);
            }
        }

        // Deletes the old geohashes that were not marked as updated.
        // This step ensures that any geohash not included in the new set of geohashes is removed.
        for (uint i = 0; i < oldGeohashes.length; i++) {
            if (!oldGeohashesUpdated[i]) { // Checks if the geohash was not updated.
                removeOIRFromGeohash(_id, oldGeohashes[i]); // Removes the OIR from the old geohash.
            }
        }
    }



    /* INSERT */

    /**
     * @dev Adds OIR data to a specific geohash. This is a private helper function.
     * 
     * This function performs three key operations:
     * 1. Stores the OIRData in the idToData mapping (once per ID).
     * 2. Adds the geohash to the list of geohashes for this ID.
     * 3. Adds the ID to the list of IDs for this geohash.
     * 
     * @param _geohash The geohash string representing the spatial location.
     * @param _oir The OIRData structure containing all data to be stored.
     * 
     * @custom:modifier onlyAllowed Only allowed users can trigger this (via upsertOIR).
     * @custom:emits DataAdded Emitted when OIR is successfully added to a geohash.
     */
    function addOIRToGeohash(string memory _geohash, OIRData memory _oir) private onlyAllowed {
        uint currentId = _oir.resourceInfo.id;

        // Store data once per ID
        idToData[currentId] = _oir;

        // Append the geohash to the mapping of ID to geohashes.
        idToGeohash[currentId].push(_geohash);

        // Append the ID to the array of IDs for the given geohash.
        geohashToIds[_geohash].push(currentId);

        // Emit an event to log the addition of new data.
        emit DataAdded(currentId, _geohash, _oir.addedBy);
    }


    /* UPDATE */

    /**
     * @dev Updates the core data for a specific OIR. This is a private helper function.
     * 
     * Only updates the OIRData in the idToData mapping. The geohash associations
     * are managed separately by the upsertOIR function.
     * 
     * @param _geohash The geohash string (used for event emission only).
     * @param _oir The new OIRData to replace the existing entry.
     * 
     * @custom:modifier onlyAllowed Only allowed users can trigger this (via upsertOIR).
     * @custom:modifier onlyOIROwner (enforced in caller) Only the OIR creator can update.
     * @custom:emits DataUpdated Emitted when OIR data is successfully updated.
     * @custom:throws "No data to be updated for the given id" if ID doesn't exist.
     * @custom:throws "Not the owner of this data" if caller is not the creator.
     */
    function updateOIRData(
        string memory _geohash, 
        OIRData memory _oir
    ) 
        private onlyAllowed
    {
        uint currentId = _oir.resourceInfo.id;
        require(idToGeohash[currentId].length > 0, "No data to be updated for the given id");

        // Check ownership using the stored data
        require(idToData[currentId].addedBy == msg.sender, "Not the owner of this data");

        // Update the data once (in idToData)
        idToData[currentId] = _oir;

        emit DataUpdated(currentId, _geohash, msg.sender);
    }
    

    /* DELETE */

    /**
     * @dev Deletes a batch of OIRs completely from the system.
     * 
     * This function removes all traces of the specified OIRs:
     * - Removes the OIR from all associated geohashes.
     * - Deletes the OIRData from idToData.
     * - Clears the geohash list for each ID.
     * 
     * Ownership is automatically verified via the onlyOIROwner modifier.
     * Only the original creator of each OIR can delete it.
     * 
     * @param _ids Array of OIR IDs to delete (must be owned by caller).
     * 
     * @custom:modifier onlyAllowed Only allowed users can call this function.
     * @custom:modifier onlyOIROwner (per ID) Only the creator of each OIR can delete it.
     * @custom:emits DataDeleted Emitted for each geohash from which the OIR is removed.
     * @custom:throws "No ids provided" if _ids array is empty.
     * @custom:throws "Not the owner of this data" if trying to delete someone else's OIR.
     */
    function deleteOIR(uint[] memory _ids) public onlyAllowed {
        require(_ids.length > 0, "No ids provided");

        // Iterate through the provided IDs to delete the associated OIRs.
        for (uint i = 0; i < _ids.length; i++) {
            uint currentId = _ids[i];
            string[] memory geohashes = idToGeohash[currentId];

            for (uint j = 0; j < geohashes.length; j++) {
                removeOIRFromGeohash(currentId, geohashes[j]);
            }
        }
    }
    
    /**
     * @dev Removes a specific OIR from a given geohash. This is a private helper function.
     * 
     * This function performs cleanup in both directions:
     * 1. Removes the ID from the geohashToIds[geohash] array.
     * 2. Removes the geohash from the idToGeohash[id] array.
     * 3. If no more geohashes remain for this ID, deletes the OIRData entirely.
     * 
     * Uses the swap-and-pop pattern for efficient array element removal.
     * 
     * @param _id The unique identifier of the OIR to be removed.
     * @param _geohash The geohash string from which to remove this OIR.
     * 
     * @custom:modifier onlyOIROwner (enforced in caller) Only the OIR creator can remove.
     * @custom:emits DataDeleted Emitted when OIR is successfully removed from geohash.
     * @custom:throws "Not the owner of this data" if caller is not the creator.
     */
    function removeOIRFromGeohash(uint _id, string memory _geohash) private {
        // Check ownership using the stored data
        require(idToData[_id].addedBy == msg.sender, "Not the owner of this data");

        // Retrieve the array of IDs associated with the given geohash.
        uint[] storage currentIds = geohashToIds[_geohash];

        // Retrieve the array of geohashes associated with the given ID.
        string[] storage currentGeohashes = idToGeohash[_id];

        // Iterate through the ID array to find and remove the specified ID.
        for (uint i = 0; i < currentIds.length; i++) {
            if (currentIds[i] == _id) {
                // Replace the ID to be deleted with the last element in the array.
                currentIds[i] = currentIds[currentIds.length - 1];

                // Remove the last element, effectively deleting the specified ID.
                currentIds.pop();
                
                break; // Exit the loop after deleting the ID.
            }
        }

        // Iterate through the geohash array to update the ID to geohash mapping.
        for (uint i = 0; i < currentGeohashes.length; i++) {
            if (keccak256(abi.encodePacked(currentGeohashes[i])) == keccak256(abi.encodePacked(_geohash))) {
                // Replace the geohash to be deleted with the last element in the array.
                currentGeohashes[i] = currentGeohashes[currentGeohashes.length - 1];

                // Remove the last element, effectively deleting the specified geohash from the ID mapping.
                currentGeohashes.pop();

                break; // Exit the loop after updating the mapping.
            }
        }

        // If no more geohashes for this ID, delete the data
        if (currentGeohashes.length == 0) {
            delete idToData[_id];
        }

        // Emit an event to log the deletion of the OIR.
        emit DataDeleted(_id, _geohash, msg.sender);
    }



    /* RETRIEVE */

    /**
     * @dev Retrieves OIRs that match specific spatial and temporal criteria.
     * 
     * This function performs a two-step lookup:
     * 1. Gets all IDs associated with the specified geohash.
     * 2. Filters IDs based on height and time interval overlap.
     * 
     * The filtering uses interval overlap logic:
     * - Height: OIR's [min, max] must overlap with query's [_minHeight, _maxHeight].
     * - Time: OIR's [start, end] must overlap with query's [_startTime, _endTime].
     * 
     * @param _geohash The geohash string to query (e.g., "u4pruydqqvj").
     * @param _minHeight Minimum height/altitude for filtering (inclusive).
     * @param _maxHeight Maximum height/altitude for filtering (inclusive).
     * @param _startTime Start timestamp for filtering (inclusive, UNIX time).
     * @param _endTime End timestamp for filtering (exclusive, UNIX time).
     * 
     * @return urls Array of URLs for matching OIRs.
     * @return entityNumbers Array of entity identifiers for matching OIRs.
     * @return ids Array of OIR IDs that match all criteria.
     * 
     * @custom:throws "Invalid height interval" if _maxHeight < _minHeight.
     * @custom:throws "Invalid time interval" if _startTime >= _endTime.
     * 
     * @custom:note This function is read-only (view) and can be called by anyone.
     * @custom:note Returns empty arrays if no OIRs match the criteria.
     */
    function getOIRsByGeohash(
        string memory _geohash, 
        uint _minHeight, 
        uint _maxHeight, 
        uint _startTime, 
        uint _endTime
    ) public view returns (string[] memory urls, uint[] memory entityNumbers, uint[] memory ids) {
        require(_maxHeight >= _minHeight, "Invalid height interval");
        require(_startTime < _endTime, "Invalid time interval");

        // Get IDs for this geohash
        uint[] storage idsInGeohash = geohashToIds[_geohash];
        uint count = 0;

        // Determine the number of entries that match the criteria.
        for (uint i = 0; i < idsInGeohash.length; i++) {
            uint currentId = idsInGeohash[i];
            OIRData storage oir = idToData[currentId];
            
            if (meetsCriteria(oir, _minHeight, _maxHeight, _startTime, _endTime)) {
                count++;
            }
        }

        // Allocate memory for the output arrays based on the count.
        urls = new string[](count);
        entityNumbers = new uint[](count);
        ids = new uint[](count);

        // Populate the output arrays with data that meets the criteria.
        uint index = 0;
        for (uint i = 0; i < idsInGeohash.length && index < count; i++) {
            uint currentId = idsInGeohash[i];
            OIRData storage oir = idToData[currentId];
            
            if (meetsCriteria(oir, _minHeight, _maxHeight, _startTime, _endTime)) {
                urls[index] = oir.resourceInfo.url;
                entityNumbers[index] = oir.resourceInfo.entityNumber;
                ids[index] = oir.resourceInfo.id;
                index++;
            }
        }

        return (urls, entityNumbers, ids);
    }

    /**
     * @dev Checks if an OIR meets filtering criteria using interval overlap logic.
     * 
     * Overlap conditions:
     * - Height overlap: OIR.min <= query.max AND OIR.max >= query.min
     * - Time overlap: OIR.start < query.end AND OIR.end > query.start
     * 
     * Both conditions must be true for the OIR to match.
     * 
     * @param _oir The OIRData structure to evaluate.
     * @param _minHeight The minimum height of the query interval.
     * @param _maxHeight The maximum height of the query interval.
     * @param _startTime The start time of the query interval (UNIX timestamp).
     * @param _endTime The end time of the query interval (UNIX timestamp).
     * 
     * @return bool True if the OIR overlaps with both the height and time intervals.
     * 
     * @custom:note This is a pure function - it doesn't read from storage.
     */
    function meetsCriteria(
        OIRData memory _oir, 
        uint _minHeight, 
        uint _maxHeight, 
        uint _startTime, 
        uint _endTime
    ) private pure returns (bool) {
        return _oir.height.min <= _maxHeight && _oir.height.max >= _minHeight && 
               _oir.time.start < _endTime && _oir.time.end > _startTime;
    }
    

    /* FALLBACK FUNCTIONS */

    // Prevents accidental Ether transfers to the contract.

    fallback() external {
        revert();
    }

    receive() external payable {
        revert();
    }
}