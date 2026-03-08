// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IQNSRegistry {
    function setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner) external returns (bytes32);
    function setResolver(bytes32 node, address resolver) external;
    function setOwner(bytes32 node, address newOwner) external;
    function owner(bytes32 node) external view returns (address);
}

interface IQNSResolver {
    function setAddr(bytes32 node, address addr) external;
    function setName(bytes32 node, string memory _name) external;
    function setReverse(address _addr, bytes32 node) external;
    function clearReverse(address _addr) external;
    function nameHash(address _addr) external view returns (bytes32);
}

contract QNSRegistrar {

    struct Registration {
        address owner;
        uint256 expires;
        uint256 registeredAt;
    }

    IQNSRegistry public registry;
    IQNSResolver public resolver;
    address public treasury;
    address public burnAddress;
    address public admin;

    uint256 public price3Char;
    uint256 public price4Char;
    uint256 public price5PlusChar;
    uint256 public permanentMultiplier;
    uint256 public burnPercent;

    uint256 public constant GRACE_PERIOD = 30 days;

    mapping(bytes32 => Registration) public registrations;
    mapping(bytes32 => bool) public reserved;
    
    // Admin analytics
    uint256 public totalRegistrations;
    string[] public reservedNamesList;
    
    // Owner-to-names mapping for efficient querying
    mapping(address => string[]) private _ownedNames;
    mapping(address => mapping(string => uint256)) private _ownedNameIndex;

    bytes32 public immutable qfNode;
    bytes32 public immutable reverseNode;

    event NameRegistered(
        string name,
        bytes32 indexed labelHash,
        address indexed owner,
        uint256 expires,
        uint256 fee
    );
    event NameRenewed(
        string name,
        bytes32 indexed labelHash,
        uint256 newExpiry,
        uint256 fee
    );
    event NameTransferred(
        string name,
        address indexed from,
        address indexed to
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "QNSRegistrar: not admin");
        _;
    }

    constructor(
        address registryAddress,
        address resolverAddress,
        address treasuryAddress,
        address _burnAddress
    ) {
        registry = IQNSRegistry(registryAddress);
        resolver = IQNSResolver(resolverAddress);
        treasury = treasuryAddress;
        burnAddress = _burnAddress;
        admin = msg.sender;

        price3Char = 1000 * 1e18;
        price4Char = 300 * 1e18;
        price5PlusChar = 100 * 1e18;
        permanentMultiplier = 15;
        burnPercent = 5;

        qfNode = keccak256(abi.encodePacked(bytes32(0), keccak256("qf")));
        reverseNode = keccak256(abi.encodePacked(bytes32(0), keccak256("reverse")));
    }

    function validateName(string memory name) internal pure returns (string memory) {
        bytes memory b = bytes(name);
        require(b.length >= 3, "QNSRegistrar: name too short");
        require(b.length <= 64, "QNSRegistrar: name too long");

        bytes memory lowered = new bytes(b.length);

        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 0x41 && c <= 0x5A) {
                lowered[i] = bytes1(c + 0x20);
            } else if ((c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39) || c == 0x2D) {
                lowered[i] = b[i];
            } else {
                revert("QNSRegistrar: invalid character");
            }
        }

        require(lowered[0] != 0x2D, "QNSRegistrar: cannot start with hyphen");
        require(lowered[b.length - 1] != 0x2D, "QNSRegistrar: cannot end with hyphen");

        return string(lowered);
    }

    function getPrice(
        uint256 nameLength,
        uint256 durationYears,
        bool permanent
    ) internal view returns (uint256) {
        uint256 basePrice;
        if (nameLength == 3) {
            basePrice = price3Char;
        } else if (nameLength == 4) {
            basePrice = price4Char;
        } else {
            basePrice = price5PlusChar;
        }

        if (permanent) {
            return basePrice * permanentMultiplier;
        } else {
            return basePrice * durationYears;
        }
    }

    function register(
        string memory name,
        uint256 durationInYears,
        bool permanent
    ) external payable {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));

        require(!reserved[labelHash], "QNSRegistrar: name is reserved");
        require(
            _isAvailable(labelHash),
            "QNSRegistrar: name not available"
        );

        uint256 nameLength = bytes(lowered).length;
        uint256 fee = getPrice(nameLength, durationInYears, permanent);
        require(msg.value >= fee, "QNSRegistrar: insufficient payment");

        uint256 expiry;
        if (permanent) {
            expiry = 0;
        } else {
            expiry = block.timestamp + (durationInYears * 365 days);
        }

        registrations[labelHash] = Registration({
            owner: msg.sender,
            expires: expiry,
            registeredAt: block.timestamp
        });
        
        totalRegistrations++;
        
        // Add to owner's name list
        _addNameToOwner(msg.sender, lowered);

        bytes32 nameNode = keccak256(abi.encodePacked(qfNode, labelHash));

        registry.setSubnodeOwner(qfNode, labelHash, address(this));
        registry.setResolver(nameNode, address(resolver));
        resolver.setAddr(nameNode, msg.sender);
        resolver.setName(nameNode, lowered);
        registry.setOwner(nameNode, msg.sender);

        // Auto-claim reverse record if user doesn't have one set
        _autoSetReverseRecord(msg.sender, lowered);

        _splitPayment(fee);

        if (msg.value > fee) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(refundSuccess, "QNSRegistrar: refund failed");
        }

        emit NameRegistered(lowered, labelHash, msg.sender, expiry, fee);
    }

    function renew(string memory name, uint256 durationYears) external payable {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));

        Registration storage reg = registrations[labelHash];
        require(reg.owner != address(0), "QNSRegistrar: name not registered");
        require(reg.expires != 0, "QNSRegistrar: cannot renew permanent name");
        require(
            block.timestamp <= reg.expires + GRACE_PERIOD,
            "QNSRegistrar: grace period expired"
        );

        uint256 nameLength = bytes(lowered).length;
        uint256 fee = getPrice(nameLength, durationYears, false);
        require(msg.value >= fee, "QNSRegistrar: insufficient payment");

        if (block.timestamp <= reg.expires) {
            reg.expires += durationYears * 365 days;
        } else {
            reg.expires = block.timestamp + (durationYears * 365 days);
        }

        _splitPayment(fee);

        if (msg.value > fee) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(refundSuccess, "QNSRegistrar: refund failed");
        }

        emit NameRenewed(lowered, labelHash, reg.expires, fee);
    }

    function available(string memory name) public view returns (bool) {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));
        if (reserved[labelHash]) {
            return false;
        }
        return _isAvailable(labelHash);
    }

    function transferName(string memory name, address newOwner) external {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));

        require(
            msg.sender == registrations[labelHash].owner,
            "QNSRegistrar: not name owner"
        );
        require(newOwner != address(0), "QNSRegistrar: zero address");

        registrations[labelHash].owner = newOwner;
        
        // Move name from old owner to new owner
        _removeNameFromOwner(msg.sender, lowered);
        _addNameToOwner(newOwner, lowered);

        bytes32 nameNode = keccak256(abi.encodePacked(qfNode, labelHash));

        registry.setSubnodeOwner(qfNode, labelHash, address(this));
        resolver.setAddr(nameNode, newOwner);
        resolver.clearReverse(msg.sender);
        resolver.setReverse(newOwner, nameNode);
        registry.setOwner(nameNode, newOwner);

        emit NameTransferred(lowered, msg.sender, newOwner);
    }

    // ──────────────────────────────────────────────
    // Reserved Names — Admin Only
    // ──────────────────────────────────────────────

    function reserveName(string memory name) external onlyAdmin {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));
        reserved[labelHash] = true;
        reservedNamesList.push(lowered);
    }

    function unreserveName(string memory name) external onlyAdmin {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));
        reserved[labelHash] = false;
        
        // Remove from reservedNamesList
        for (uint256 i = 0; i < reservedNamesList.length; i++) {
            if (keccak256(bytes(reservedNamesList[i])) == labelHash) {
                reservedNamesList[i] = reservedNamesList[reservedNamesList.length - 1];
                reservedNamesList.pop();
                break;
            }
        }
    }

    function assignReservedName(string memory name, address to) external onlyAdmin {
        string memory lowered = validateName(name);
        bytes32 labelHash = keccak256(bytes(lowered));
        require(reserved[labelHash], "QNSRegistrar: name not reserved");

        registrations[labelHash] = Registration({
            owner: to,
            expires: 0,
            registeredAt: block.timestamp
        });
        
        totalRegistrations++;
        
        // Add to owner's name list
        _addNameToOwner(to, lowered);

        bytes32 nameNode = keccak256(abi.encodePacked(qfNode, labelHash));

        registry.setSubnodeOwner(qfNode, labelHash, address(this));
        registry.setResolver(nameNode, address(resolver));
        resolver.setAddr(nameNode, to);
        resolver.setName(nameNode, lowered);
        registry.setOwner(nameNode, to);

        // Auto-claim reverse record if recipient doesn't have one set
        _autoSetReverseRecord(to, lowered);

        reserved[labelHash] = false;

        emit NameRegistered(lowered, labelHash, to, 0, 0);
    }

    // ──────────────────────────────────────────────
    // Admin Functions
    // ──────────────────────────────────────────────

    function setPrice(uint256 new3, uint256 new4, uint256 new5Plus) external onlyAdmin {
        price3Char = new3;
        price4Char = new4;
        price5PlusChar = new5Plus;
    }

    function setPermanentMultiplier(uint256 newMult) external onlyAdmin {
        permanentMultiplier = newMult;
    }

    function setBurnPercent(uint256 newPercent) external onlyAdmin {
        require(newPercent <= 50, "QNSRegistrar: burn percent too high");
        burnPercent = newPercent;
    }

    function setTreasury(address newTreasury) external onlyAdmin {
        treasury = newTreasury;
    }

    function setBurnAddress(address newBurn) external onlyAdmin {
        burnAddress = newBurn;
    }

    function withdrawToTreasury() external onlyAdmin {
        uint256 balance = address(this).balance;
        require(balance > 0, "QNSRegistrar: no balance");
        (bool success, ) = payable(treasury).call{value: balance}("");
        require(success, "QNSRegistrar: withdrawal failed");
    }

    function setDefaultResolver(address newResolver) external onlyAdmin {
        resolver = IQNSResolver(newResolver);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "QNSRegistrar: zero address");
        admin = newAdmin;
    }

    function getNamesByOwner(address owner) external view returns (string[] memory) {
        return _ownedNames[owner];
    }

    // ──────────────────────────────────────────────
    // Internal Helpers
    // ──────────────────────────────────────────────

    function _addNameToOwner(address owner, string memory name) internal {
        _ownedNames[owner].push(name);
        _ownedNameIndex[owner][name] = _ownedNames[owner].length;
    }

    function _removeNameFromOwner(address owner, string memory name) internal {
        uint256 index = _ownedNameIndex[owner][name];
        require(index > 0, "QNSRegistrar: name not owned");
        
        uint256 arrIndex = index - 1;
        uint256 lastIndex = _ownedNames[owner].length - 1;
        
        if (arrIndex != lastIndex) {
            string memory lastName = _ownedNames[owner][lastIndex];
            _ownedNames[owner][arrIndex] = lastName;
            _ownedNameIndex[owner][lastName] = arrIndex + 1;
        }
        
        _ownedNames[owner].pop();
        delete _ownedNameIndex[owner][name];
    }

    function getReservedNames() external view returns (string[] memory) {
        return reservedNamesList;
    }

    // ──────────────────────────────────────────────
    // Internal Helpers
    // ──────────────────────────────────────────────

    function _autoSetReverseRecord(address addr, string memory name) internal {
        // Check if user already has a reverse record
        bytes32 existingNode = resolver.nameHash(addr);
        if (existingNode != bytes32(0)) {
            // User already has a primary name set, don't overwrite
            return;
        }

        // Convert address to hex string (without 0x prefix, lowercase)
        string memory addrStr = _addrToString(addr);

        // Compute the user's reverse subnode label hash
        bytes32 addrLabelHash = keccak256(bytes(addrStr));

        // Compute the user's reverse node: reverseNode + addrLabelHash
        bytes32 userReverseNode = keccak256(abi.encodePacked(reverseNode, addrLabelHash));

        // Claim the reverse subnode for this user (Registrar owns reverse node, so it can do this)
        registry.setSubnodeOwner(reverseNode, addrLabelHash, addr);

        // Set the name on the reverse node (Resolver checks msg.sender is the node owner)
        // Note: The user (addr) needs to be the owner to call setName, so we use a different approach
        // Since the Resolver is authorized to set names, we can use a different approach
        // Actually, we need to check the Resolver's authorization model
        // Looking at QNSResolver: setName requires isAuthorized(node)
        // isAuthorized checks: msg.sender == registry.owner(node) || authorizedCallers[msg.sender]
        // The Registrar IS an authorized caller (added in deploy.mjs)
        // So we can directly call resolver.setName()

        // Set the reverse record in the resolver (maps address => node)
        resolver.setReverse(addr, userReverseNode);

        // Set the name on the reverse node (Registrar is authorized caller)
        resolver.setName(userReverseNode, name);
    }

    function _addrToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            str[i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[1 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    function _isAvailable(bytes32 labelHash) internal view returns (bool) {
        Registration storage reg = registrations[labelHash];
        if (reg.owner == address(0)) {
            return true;
        }
        if (reg.expires != 0 && block.timestamp > reg.expires + GRACE_PERIOD) {
            return true;
        }
        return false;
    }

    function _splitPayment(uint256 fee) internal {
        uint256 burnAmount = (fee * burnPercent) / 100;
        if (burnAmount > 0) {
            (bool burnSuccess, ) = payable(burnAddress).call{value: burnAmount}("");
            require(burnSuccess, "QNSRegistrar: burn transfer failed");
        }
    }

    receive() external payable {}
}
