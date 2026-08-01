<?php
require_once __DIR__ . '/includes/config.php';

$conn = new mysqli($db_host, $db_username, $db_password, $db_name);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
}

echo "Running schema setup...\n";

$conn->query("CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status ENUM('pending','approved') DEFAULT 'approved'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
echo "  - accounts table OK\n";

$conn->query("CREATE TABLE IF NOT EXISTS group_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rater_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    content_accuracy INT DEFAULT 0,
    understanding_topic INT DEFAULT 0,
    organization_structure INT DEFAULT 0,
    delivery_communication INT DEFAULT 0,
    audience_engagement INT DEFAULT 0,
    visual_aids INT DEFAULT 0,
    professional_appearance INT DEFAULT 0,
    teamwork_collaboration INT DEFAULT 0,
    time_allocation INT DEFAULT 0,
    strategies INT DEFAULT 0,
    total_score INT DEFAULT 0,
    instructor VARCHAR(255) DEFAULT '',
    section VARCHAR(255) DEFAULT '',
    UNIQUE KEY unique_group_rate_section (rater_name, group_name, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
echo "  - group_ratings table OK\n";

$conn->query("CREATE TABLE IF NOT EXISTS groups_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    instructor VARCHAR(255),
    member1_name VARCHAR(255) DEFAULT '',
    member2_name VARCHAR(255) DEFAULT '',
    member3_name VARCHAR(255) DEFAULT '',
    member4_name VARCHAR(255) DEFAULT '',
    member5_name VARCHAR(255) DEFAULT '',
    is_closed TINYINT(1) DEFAULT 0,
    section VARCHAR(255) DEFAULT '',
    UNIQUE KEY unique_group_instructor_section (group_name, instructor, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
echo "  - groups_table table OK\n";

$conn->query("CREATE TABLE IF NOT EXISTS section_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor VARCHAR(255) NOT NULL,
    section_name VARCHAR(255) NOT NULL,
    max_score INT DEFAULT 1000,
    UNIQUE KEY unique_instructor_section (instructor, section_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
echo "  - section_config table OK\n";

// --- Migrations ---
$r = $conn->query("SHOW COLUMNS FROM groups_table LIKE 'section'");
if ($r && $r->num_rows === 0) {
    $conn->query("ALTER TABLE groups_table ADD COLUMN section VARCHAR(255) DEFAULT ''");
    echo "  - added section column to groups_table\n";
}
$r = $conn->query("SHOW COLUMNS FROM group_ratings LIKE 'section'");
if ($r && $r->num_rows === 0) {
    $conn->query("ALTER TABLE group_ratings ADD COLUMN section VARCHAR(255) DEFAULT ''");
    echo "  - added section column to group_ratings\n";
}

$r = $conn->query("SHOW INDEX FROM groups_table WHERE Key_name='unique_group_instructor'");
if ($r && $r->num_rows > 0) {
    $conn->query("ALTER TABLE groups_table DROP INDEX unique_group_instructor");
    echo "  - dropped old index unique_group_instructor\n";
}
$r = $conn->query("SHOW INDEX FROM group_ratings WHERE Key_name='unique_group_rate'");
if ($r && $r->num_rows > 0) {
    $conn->query("ALTER TABLE group_ratings DROP INDEX unique_group_rate");
    echo "  - dropped old index unique_group_rate\n";
}

$r = $conn->query("SHOW COLUMNS FROM groups_table LIKE 'member4_name'");
if ($r && $r->num_rows === 0) {
    $conn->query("ALTER TABLE groups_table ADD COLUMN member4_name VARCHAR(255) DEFAULT '' AFTER member3_name");
    echo "  - added member4_name column to groups_table\n";
}
$r = $conn->query("SHOW COLUMNS FROM groups_table LIKE 'member5_name'");
if ($r && $r->num_rows === 0) {
    $conn->query("ALTER TABLE groups_table ADD COLUMN member5_name VARCHAR(255) DEFAULT '' AFTER member4_name");
    echo "  - added member5_name column to groups_table\n";
}

$r = $conn->query("SHOW COLUMNS FROM group_ratings LIKE 'rating_number'");
if ($r && $r->num_rows > 0) {
    $conn->query("ALTER TABLE group_ratings DROP COLUMN rating_number");
    echo "  - dropped rating_number column\n";
}

echo "\nSetup complete. You can now delete this file.\n";
$conn->close();
?>
