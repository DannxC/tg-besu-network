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

    /// @dev Represents a chunk of geospatial data.
    struct ChunkData {
        address addedBy; // Address of the user who added the chunk.
        HeightInterval height;
        TimeInterval time;
        ResourceInfo resourceInfo;
    }


    /* STATE VARIABLES */

    /// @dev Maps an ID to an array of geohashes.
    mapping(uint => string[]) public idToGeohash;
    /// @dev Maps a geohash to an array of ChunkData.
    mapping(string => ChunkData[]) public geohashToChunkDataArray;
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

    /// @dev Constructor sets the deployer as the owner and allows the owner to perform operations.
    constructor() {
        owner = msg.sender;
        allowUser(owner);
    }

    /// @dev Allows the owner to grant a user access to perform operations.
    function allowUser(address _user) public onlyOwner {
        allowedUsers[_user] = true;
    }

    /// @dev Allows the owner to revoke a user's access.
    function disallowUser(address _user) public onlyOwner {
        allowedUsers[_user] = false;
    }

    /// @dev Transfers contract ownership to a new owner.
    function changeOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }


    /* UPSERT */

    /**
     * @dev Adds or updates a polygon data, represented as a set of geohashes and corresponding ChunkData.
     * A polygon is part of a full route. This function checks for existing data and updates or deletes as necessary.
     */
    function upsertPolygonData (
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

        // Create a new ChunkData object with the provided data.
        HeightInterval memory height = HeightInterval({min: _minHeight, max: _maxHeight});
        TimeInterval memory time = TimeInterval({start: _startTime, end: _endTime});
        ResourceInfo memory resourceInfo = ResourceInfo({url: _url, entityNumber: _entity, id: _id});
        ChunkData memory newChunkData = ChunkData({
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
            // If it exists, update the corresponding ChunkData.
            for (uint j = 0; j < oldGeohashes.length; j++) {
                if (keccak256(abi.encodePacked(currentNewGeohash)) == keccak256(abi.encodePacked(oldGeohashes[j]))) {
                    exists = true; // Marks that the current new geohash exists in old geohashes.
                    oldGeohashesUpdated[j] = true; // Marks this geohash as updated in the tracking array.

                    // Calls updateChunkData to update the existing ChunkData with the new data.
                    updateChunkData(currentNewGeohash, newChunkData);
                    break; // Breaks the loop since the update is done.
                }
            }

            // If the current new geohash does not exist in the old geohashes, insert it as new data.
            if (!exists) {
                insertChunkData(currentNewGeohash, newChunkData);
            }
        }

        // Deletes the old geohashes that were not marked as updated.
        // This step ensures that any geohash not included in the new set of geohashes is removed.
        for (uint i = 0; i < oldGeohashes.length; i++) {
            if (!oldGeohashesUpdated[i]) { // Checks if the geohash was not updated.
                deleteChunkData(_id, oldGeohashes[i]); // Deletes the ChunkData associated with the old geohash.
            }
        }
    }



    /* INSERT */

    /**
     * @dev Inserts new ChunkData for a given geohash. This function is called internally
     * to add data without duplicating logic for single or batch insertions.
     * @param _geohash The geohash representing the spatial location of the data.
     * @param _chunkData The ChunkData structure containing the data to be added.
     */
    function insertChunkData(string memory _geohash, ChunkData memory _chunkData) private onlyAllowed {
        uint currentId = _chunkData.resourceInfo.id;

        // Append the geohash to the mapping of ID to geohashes.
        idToGeohash[currentId].push(_geohash);

        // Append the new ChunkData to the array of ChunkData for the given geohash.
        geohashToChunkDataArray[_geohash].push(_chunkData);

        // Emit an event to log the addition of new data.
        emit DataAdded(currentId, _geohash, _chunkData.addedBy);
    }


    /* UPDATE */

    /**
     * @dev Updates the data for a specific ChunkData entry identified by geohash and internal ID.
     * Access is restricted to the data's original creator.
     * @param _geohash The geohash of the ChunkData to be updated.
     * @param _chunkData The new ChunkData to replace the existing entry.
     */
    function updateChunkData(
        string memory _geohash, 
        ChunkData memory _chunkData
    ) 
        private onlyAllowed
    {
        require(_chunkData.addedBy == msg.sender, "Not the owner of this data");

        // Get the ID of the ChunkData to be updated.
        uint currentId = _chunkData.resourceInfo.id;
        require(idToGeohash[currentId].length > 0, "No data to be updated for the given id");

        // Find and update the specified ChunkData within the array.
        ChunkData[] storage chunkDataArray = geohashToChunkDataArray[_geohash];
        for (uint i = 0; i < chunkDataArray.length; i++) {
            if (chunkDataArray[i].resourceInfo.id == currentId) {
                chunkDataArray[i] = _chunkData;
                emit DataUpdated(currentId, _geohash, msg.sender);
                break;
            }
        }
    }
    

    /* DELETE */

    /**
     * @dev Deletes a batch of ChunkData identified by their IDs. This function allows for efficient
     * removal of multiple data entries and is accessible only to allowed users.
     * @param _ids An array of IDs corresponding to the ChunkData entries to be deleted.
     */
    function deletePolygonData(uint[] memory _ids) public onlyAllowed {
        require(_ids.length > 0, "No ids provided");

        // Iterate through the provided IDs to delete the associated ChunkData.
        for (uint i = 0; i < _ids.length; i++) {
            uint currentId = _ids[i];
            string[] memory geohashes = idToGeohash[currentId];

            for (uint j = 0; j < geohashes.length; j++) {
                deleteChunkData(currentId, geohashes[j]);
            }
        }
    }
    
    /**
     * @dev Removes a specific ChunkData entry identified by its ID from the geohash mapping.
     * This operation is restricted to the creator of the ChunkData. It updates both the
     * geohash to ChunkData mapping and the ID to geohash mapping to ensure data integrity.
     * @param _id The unique identifier of the ChunkData to be removed.
     * @param _geohash The geohash string that the ChunkData is associated with.
     */
    function deleteChunkData(uint _id, string memory _geohash) private {
        // Retrieve the array of ChunkData associated with the given geohash.
        ChunkData[] storage currentChunkDataArray = geohashToChunkDataArray[_geohash];

        // Retrieve the array of geohashes associated with the given ID.
        string[] storage currentGeohashes = idToGeohash[_id];

        // Iterate through the ChunkData array to find and remove the specified ChunkData.
        for (uint i = 0; i < currentChunkDataArray.length; i++) {
            if (currentChunkDataArray[i].resourceInfo.id == _id) {
                // Check if the caller is the creator of the ChunkData.
                require(currentChunkDataArray[i].addedBy == msg.sender, "Not the owner of this data");

                // Replace the ChunkData to be deleted with the last element in the array.
                currentChunkDataArray[i] = currentChunkDataArray[currentChunkDataArray.length - 1];

                // Remove the last element, effectively deleting the specified ChunkData.
                currentChunkDataArray.pop();
                
                break; // Exit the loop after deleting the ChunkData.
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

        // Emit an event to log the deletion of the ChunkData.
        emit DataDeleted(_id, _geohash, msg.sender);
    }



    /* RETRIEVE */

    /**
     * @dev Retrieves data matching the specified criteria. This function allows users to query
     * data based on geohash, height interval, and time interval, facilitating efficient data lookup.
     * @param _geohash The geohash to query.
     * @param _minHeight The minimum height of the data.
     * @param _maxHeight The maximum height of the data.
     * @param _startTime The start time of the data interval.
     * @param _endTime The end time of the data interval.
     * @return urls An array of URLs for the matching data.
     * @return entityNumbers An array of entity numbers for the matching data.
     * @return ids An array of IDs for the matching data.
     */
    function getData(
        string memory _geohash, 
        uint _minHeight, 
        uint _maxHeight, 
        uint _startTime, 
        uint _endTime
    ) public view returns (string[] memory urls, uint[] memory entityNumbers, uint[] memory ids) {
        require(_maxHeight >= _minHeight, "Invalid height interval");
        require(_startTime < _endTime, "Invalid time interval");

        ChunkData[] storage chunkDataArray = geohashToChunkDataArray[_geohash];
        uint count = 0;

        // Determine the number of entries that match the criteria.
        for (uint i = 0; i < chunkDataArray.length; i++) {
            if (meetsCriteria(chunkDataArray[i], _minHeight, _maxHeight, _startTime, _endTime)) {
                count++;
            }
        }

        // Allocate memory for the output arrays based on the count.
        urls = new string[](count);
        entityNumbers = new uint[](count);
        ids = new uint[](count);

        // Populate the output arrays with data that meets the criteria.
        uint index = 0;
        for (uint i = 0; i < chunkDataArray.length && index < count; i++) {
            if (meetsCriteria(chunkDataArray[i], _minHeight, _maxHeight, _startTime, _endTime)) {
                urls[index] = chunkDataArray[i].resourceInfo.url;
                entityNumbers[index] = chunkDataArray[i].resourceInfo.entityNumber;
                ids[index] = chunkDataArray[i].resourceInfo.id;
                index++;
            }
        }

        return (urls, entityNumbers, ids);
    }

    /**
     * @dev Evaluates if a given ChunkData meets specified criteria based on height and time intervals.
     * This function is used to filter ChunkData during data retrieval operations, ensuring that only
     * data entries matching all criteria are selected.
     * 
     * @param _chunkData The ChunkData structure to evaluate.
     * @param _minHeight The minimum height value of the filtering criteria.
     * @param _maxHeight The maximum height value of the filtering criteria.
     * @param _startTime The start time value (inclusive) of the filtering criteria, represented as a UNIX timestamp.
     * @param _endTime The end time value (exclusive) of the filtering criteria, represented as a UNIX timestamp.
     * 
     * @return bool Returns true if the ChunkData satisfies all criteria; otherwise, returns false.
     */
    function meetsCriteria(
        ChunkData memory _chunkData, 
        uint _minHeight, 
        uint _maxHeight, 
        uint _startTime, 
        uint _endTime
    ) private pure returns (bool) {
        return _chunkData.height.min <= _maxHeight && _chunkData.height.max >= _minHeight && 
               _chunkData.time.start < _endTime && _chunkData.time.end > _startTime;
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