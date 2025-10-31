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

    /// @dev Emitted when a new data chunk is added to a geohash.
    event DataAdded(bytes32 indexed id, bytes32 indexed geohash, address indexed createdBy);
    /// @dev Emitted when existing data chunk is updated.
    event DataUpdated(bytes32 indexed id, bytes32 indexed geohash, address updatedBy);
    /// @dev Emitted when a data chunk is deleted from a geohash.
    event DataDeleted(bytes32 indexed id, bytes32 indexed geohash, address deletedBy);


    /* STRUCTS */

    /// @dev Represents the core data of an Operational Intent Reference (OIR).
    /// Note: The complete OIR includes this data + geohashes stored in idToGeohash mapping.
    /// 
    /// Storage layout: ~124 bytes + dynamic string (optimized packing!)
    /// Slot 0: createdBy (20 bytes) + minHeight (2 bytes) + maxHeight (2 bytes) + entityNumber (2 bytes) = 26 bytes (fits in 1 slot)
    /// Slot 1: lastUpdatedBy (20 bytes) + padding (12 bytes)
    /// Slot 2: startTime (8 bytes) + endTime (8 bytes) = 16 bytes (fits in 1 slot)
    /// Slot 3: id (32 bytes)
    /// Slot 4+: url (dynamic string)
    struct OIRData {
        address createdBy;        // 20 bytes - Address of the user who originally created the OIR
        uint16 minHeight;         // 2 bytes  - Minimum altitude in meters (0 to 65,535)
        uint16 maxHeight;         // 2 bytes  - Maximum altitude in meters (0 to 65,535)
        uint16 entityNumber;      // 2 bytes  - Entity identifier (0 to 65,535)
        address lastUpdatedBy;    // 20 bytes - Address of the user who last modified the OIR (new slot)
        uint64 startTime;         // 8 bytes  - Epoch timestamp in milliseconds (0 to ~584 million years)
        uint64 endTime;           // 8 bytes  - Epoch timestamp in milliseconds (0 to ~584 million years)
        bytes32 id;               // 32 bytes - Unique identifier for this OIR
        string url;               // Dynamic - URL pointing to detailed OIR information
    }


    /* STATE VARIABLES */

    /// @dev Maps an ID (bytes32) to its OIR data (stored once per ID).
    mapping(bytes32 => OIRData) public idToData;
    /// @dev Maps an ID to an array of geohashes (bytes32).
    mapping(bytes32 => bytes32[]) public idToGeohash;
    /// @dev Maps a geohash (bytes32) to an array of IDs (bytes32).
    mapping(bytes32 => bytes32[]) public geohashToIds;
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
     * The owner cannot be removed from allowedUsers to ensure contract manageability.
     * @param _user The address to revoke permissions from.
     * @custom:modifier onlyOwner Only the contract owner can call this function.
     * @custom:throws "Owner cannot be removed" if attempting to remove the owner.
     */
    function disallowUser(address _user) public onlyOwner {
        require(_user != owner, "Owner cannot be removed");
        allowedUsers[_user] = false;
    }

    /**
     * @dev Transfers contract ownership to a new address.
     * The new owner must already be in the allowedUsers list and cannot be address(0).
     * @param _newOwner The address of the new owner.
     * @custom:modifier onlyOwner Only the current owner can transfer ownership.
     * @custom:throws "New owner cannot be zero address" if _newOwner is address(0).
     * @custom:throws "New owner must be allowed already" if _newOwner is not in allowedUsers.
     */
    function changeOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        require(allowedUsers[_newOwner], "New owner must be allowed already");
        owner = _newOwner;
    }


    /* UPSERT */

    /**
     * @dev Adds or updates an OIR (Operational Intent Reference), represented as a set of geohashes.
     * 
     * This function performs intelligent upsert logic:
     * - If the ID is new: inserts the OIR data into all specified geohashes.
     *   Sets createdBy = msg.sender and lastUpdatedBy = msg.sender.
     * - If the ID exists: updates the OIR data and manages geohash associations.
     *   Preserves createdBy, updates lastUpdatedBy = msg.sender.
     *   - Geohashes that exist in both old and new lists: data is updated.
     *   - New geohashes are added.
     *   - Old geohashes not in the new list are removed.
     * 
     * Any allowed user can update any OIR, regardless of who created it.
     * 
     * @param _geohashes Array of geohash bytes32 representing the spatial coverage (calldata = no copy, cheaper!).
     * @param _minHeight Minimum height/altitude in meters (0 to 65,535).
     * @param _maxHeight Maximum height/altitude in meters (0 to 65,535).
     * @param _startTime Start timestamp in milliseconds (epoch, 0 to ~584 million years).
     * @param _endTime End timestamp in milliseconds (epoch, 0 to ~584 million years).
     * @param _url URL pointing to detailed OIR information (calldata = no copy).
     * @param _entity Entity number/identifier (0 to 65,535).
     * @param _id Unique identifier for this OIR (bytes32).
     * 
     * @custom:modifier onlyAllowed Only allowed users can call this function.
     * 
     * @custom:throws "No geohashes provided" if _geohashes array is empty.
     * @custom:throws "Invalid height interval" if _maxHeight < _minHeight.
     * @custom:throws "Invalid time interval" if _startTime >= _endTime.
     * 
     * @custom:note Using calldata for arrays saves ~3x gas compared to memory (no copy operation).
     */
    function upsertOIR (
        bytes32[] calldata _geohashes,
        uint16 _minHeight,
        uint16 _maxHeight,
        uint64 _startTime,
        uint64 _endTime,
        string calldata _url,
        uint16 _entity,
        bytes32 _id
    ) 
        public onlyAllowed
    {
        require(_geohashes.length > 0, "No geohashes provided");
        require(_maxHeight >= _minHeight, "Invalid height interval");
        require(_startTime < _endTime, "Invalid time interval");

        // Check if this is a new OIR or an update
        bool isNewOIR = (idToGeohash[_id].length == 0);

        // Determine createdBy: preserve original creator or set as msg.sender for new OIRs
        address createdByAddress;
        if (isNewOIR) {
            createdByAddress = msg.sender;
        } else {
            createdByAddress = idToData[_id].createdBy;
        }

        // Create a new OIRData object with the provided data
        OIRData memory newOIR = OIRData({
            createdBy: createdByAddress,
            minHeight: _minHeight,
            maxHeight: _maxHeight,
            entityNumber: _entity,
            lastUpdatedBy: msg.sender,
            startTime: _startTime,
            endTime: _endTime,
            id: _id,
            url: _url
        });

        // For new OIRs: simply add all geohashes
        // For existing OIRs: update/add/remove as needed
        if (isNewOIR) {
            // Simple case: just add all new geohashes
            for (uint16 i = 0; i < _geohashes.length; i++) {
                addOIRToGeohash(_geohashes[i], newOIR);
            }
        } else {
            // Complex case: manage existing geohashes
            // CRITICAL: Copy to memory first! Storage pointer would be modified during iteration
            bytes32[] memory oldGeohashes = idToGeohash[_id]; // Memory copy (prevents mutation bugs)
            bool[] memory oldGeohashesProcessed = new bool[](oldGeohashes.length);
            
            // Process new geohashes: check if exists in old, then update or add
            for (uint16 i = 0; i < _geohashes.length; i++) {
                bytes32 currentGeohash = _geohashes[i];
                bool foundInOld = false;
                
                // Check if this geohash exists in old geohashes - direct bytes32 comparison!
                for (uint16 j = 0; j < oldGeohashes.length; j++) {
                    if (currentGeohash == oldGeohashes[j]) {
                        foundInOld = true;
                        oldGeohashesProcessed[j] = true; // Mark as processed
                        updateOIRData(currentGeohash, newOIR);
                        break;
                    }
                }
                
                if (!foundInOld) {
                    // New geohash: add
                    addOIRToGeohash(currentGeohash, newOIR);
                }
            }

            // Remove old geohashes that were not processed (not in new list)
            for (uint16 i = 0; i < oldGeohashes.length; i++) {
                if (!oldGeohashesProcessed[i]) {
                    removeOIRFromGeohash(_id, oldGeohashes[i]);
                }
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
     * @param _geohash The geohash bytes32 representing the spatial location.
     * @param _oir The OIRData structure containing all data to be stored.
     * 
     * @custom:emits DataAdded Emitted when OIR is successfully added to a geohash.
     */
    function addOIRToGeohash(bytes32 _geohash, OIRData memory _oir) private {
        bytes32 currentId = _oir.id;

        // Store data once per ID
        idToData[currentId] = _oir;

        // Append the geohash to the mapping of ID to geohashes
        idToGeohash[currentId].push(_geohash);

        // Append the ID to the array of IDs for the given geohash
        geohashToIds[_geohash].push(currentId);

        // Emit an event to log the addition of new data
        emit DataAdded(currentId, _geohash, _oir.createdBy);
    }


    /* UPDATE */

    /**
     * @dev Updates the core data for a specific OIR. This is a private helper function.
     * 
     * Only updates the OIRData in the idToData mapping. The geohash associations
     * are managed separately by the upsertOIR function.
     * 
     * Any allowed user can update any OIR. The lastUpdatedBy field tracks who made the change.
     * 
     * @param _geohash The geohash bytes32 (used for event emission only).
     * @param _oir The new OIRData to replace the existing entry.
     * 
     * @custom:emits DataUpdated Emitted when OIR data is successfully updated.
     */
    function updateOIRData(
        bytes32 _geohash, 
        OIRData memory _oir
    ) 
        private
    {
        bytes32 currentId = _oir.id;

        // Update the data once (in idToData)
        idToData[currentId] = _oir;

        emit DataUpdated(currentId, _geohash, _oir.lastUpdatedBy);
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
     * Any allowed user can delete any OIR, regardless of who created it.
     * If an ID doesn't exist, it is silently ignored (no revert).
     * 
     * @param _ids Array of OIR IDs (bytes32) to delete (calldata = no copy).
     * 
     * @custom:modifier onlyAllowed Only allowed users can call this function.
     * @custom:emits DataDeleted Emitted for each geohash from which the OIR is removed.
     * @custom:throws "No ids provided" if _ids array is empty.
     */
    function deleteOIR(bytes32[] calldata _ids) public onlyAllowed {
        require(_ids.length > 0, "No ids provided");

        // Iterate through the provided IDs to delete the associated OIRs
        for (uint16 i = 0; i < _ids.length; i++) { // uint16 = 0 to 65,535 IDs per batch
            bytes32 currentId = _ids[i];
            // CRITICAL: Copy to memory first! Storage pointer would be modified during iteration
            bytes32[] memory geohashes = idToGeohash[currentId]; // Memory copy (prevents mutation bugs)

            for (uint16 j = 0; j < geohashes.length; j++) {
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
     * @param _id The unique identifier (bytes32) of the OIR to be removed.
     * @param _geohash The geohash bytes32 from which to remove this OIR.
     * 
     * @custom:emits DataDeleted Emitted when OIR is successfully removed from geohash.
     */
    function removeOIRFromGeohash(bytes32 _id, bytes32 _geohash) private {

        // Retrieve the array of IDs associated with the given geohash (storage pointer)
        bytes32[] storage currentIds = geohashToIds[_geohash];

        // Retrieve the array of geohashes associated with the given ID (storage pointer)
        bytes32[] storage currentGeohashes = idToGeohash[_id];

        // Iterate through the ID array to find and remove the specified ID
        for (uint16 i = 0; i < currentIds.length; i++) { // uint16 = 0 to 65,535 IDs per geohash
            if (currentIds[i] == _id) {
                // Swap-and-pop: replace with last element
                currentIds[i] = currentIds[currentIds.length - 1];
                currentIds.pop();
                break; // Exit after deleting
            }
        }
        // Iterate through the geohash array to find and remove the specified geohash
        // No need for keccak256 anymore - direct bytes32 comparison!
        for (uint16 i = 0; i < currentGeohashes.length; i++) {
            if (currentGeohashes[i] == _geohash) { // Direct comparison (much cheaper!)
                // Swap-and-pop: replace with last element
                currentGeohashes[i] = currentGeohashes[currentGeohashes.length - 1];
                currentGeohashes.pop();
                break; // Exit after deleting
            }
        }

        // If no more geohashes for this ID, delete the data
        if (currentGeohashes.length == 0) {
            delete idToData[_id];
        }

        // Emit an event to log the deletion
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
     * @param _geohash The geohash bytes32 to query.
     * @param _minHeight Minimum height/altitude for filtering in meters (0 to 65,535).
     * @param _maxHeight Maximum height/altitude for filtering in meters (0 to 65,535).
     * @param _startTime Start timestamp for filtering in milliseconds (epoch, 0 to ~584 million years).
     * @param _endTime End timestamp for filtering in milliseconds (epoch, 0 to ~584 million years).
     * 
     * @return urls Array of URLs for matching OIRs.
     * @return entityNumbers Array of entity identifiers for matching OIRs.
     * @return ids Array of OIR IDs (bytes32) that match all criteria.
     * 
     * @custom:throws "Invalid height interval" if _maxHeight < _minHeight.
     * @custom:throws "Invalid time interval" if _startTime >= _endTime.
     * 
     * @custom:note This function is read-only (view) and can be called by anyone.
     * @custom:note Returns empty arrays if no OIRs match the criteria.
     */
    function getOIRsByGeohash(
        bytes32 _geohash, 
        uint16 _minHeight, 
        uint16 _maxHeight, 
        uint64 _startTime, 
        uint64 _endTime
    ) public view returns (string[] memory urls, uint16[] memory entityNumbers, bytes32[] memory ids) {
        require(_maxHeight >= _minHeight, "Invalid height interval");
        require(_startTime < _endTime, "Invalid time interval");

        // Get IDs for this geohash (storage pointer - no copy!)
        bytes32[] storage idsInGeohash = geohashToIds[_geohash];
        uint16 count = 0; // uint16 = max 65,535 matches

        // First pass: count matches
        for (uint16 i = 0; i < idsInGeohash.length; i++) {
            bytes32 currentId = idsInGeohash[i];
            OIRData storage oir = idToData[currentId];
            
            if (meetsCriteria(oir, _minHeight, _maxHeight, _startTime, _endTime)) {
                count++;
            }
        }

        // Allocate memory for output arrays based on the count
        urls = new string[](count);
        entityNumbers = new uint16[](count);
        ids = new bytes32[](count);

        // Second pass: populate output arrays
        uint16 index = 0;
        for (uint16 i = 0; i < idsInGeohash.length && index < count; i++) {
            bytes32 currentId = idsInGeohash[i];
            OIRData storage oir = idToData[currentId];
            
            if (meetsCriteria(oir, _minHeight, _maxHeight, _startTime, _endTime)) {
                urls[index] = oir.url;
                entityNumbers[index] = oir.entityNumber;
                ids[index] = oir.id;
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
     * @param _minHeight The minimum height of the query interval (0 to 65,535).
     * @param _maxHeight The maximum height of the query interval (0 to 65,535).
     * @param _startTime The start time of the query interval in milliseconds (epoch, 0 to ~584 million years).
     * @param _endTime The end time of the query interval in milliseconds (epoch, 0 to ~584 million years).
     * 
     * @return bool True if the OIR overlaps with both the height and time intervals.
     * 
     * @custom:note This is a pure function - it doesn't read from storage.
     */
    function meetsCriteria(
        OIRData memory _oir, 
        uint16 _minHeight, 
        uint16 _maxHeight, 
        uint64 _startTime, 
        uint64 _endTime
    ) private pure returns (bool) {
        return _oir.minHeight <= _maxHeight && _oir.maxHeight >= _minHeight && 
               _oir.startTime < _endTime && _oir.endTime > _startTime;
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