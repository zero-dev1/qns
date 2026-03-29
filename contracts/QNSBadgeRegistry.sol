// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract QNSBadgeRegistry {
    address public admin;

    mapping(bytes32 => mapping(string => bool)) private _badges;

    event BadgeAssigned(bytes32 indexed nameHash, string badgeType);
    event BadgeRevoked(bytes32 indexed nameHash, string badgeType);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function assignBadge(bytes32 nameHash, string calldata badgeType) external onlyAdmin {
        _badges[nameHash][badgeType] = true;
        emit BadgeAssigned(nameHash, badgeType);
    }

    function assignBadgeBatch(
        bytes32[] calldata nameHashes,
        string calldata badgeType
    ) external onlyAdmin {
        for (uint256 i = 0; i < nameHashes.length; i++) {
            _badges[nameHashes[i]][badgeType] = true;
            emit BadgeAssigned(nameHashes[i], badgeType);
        }
    }

    function revokeBadge(bytes32 nameHash, string calldata badgeType) external onlyAdmin {
        _badges[nameHash][badgeType] = false;
        emit BadgeRevoked(nameHash, badgeType);
    }

    function hasBadge(bytes32 nameHash, string calldata badgeType) external view returns (bool) {
        return _badges[nameHash][badgeType];
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }
}
