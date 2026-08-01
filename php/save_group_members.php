<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
$instructor = $_POST['instructor'] ?? '';
$group_name = $_POST['group_name'] ?? '';
$section = $_POST['section'] ?? '';
$member1 = strtoupper(trim($_POST['member1_name'] ?? ''));
$member2 = strtoupper(trim($_POST['member2_name'] ?? ''));
$member3 = strtoupper(trim($_POST['member3_name'] ?? ''));
$member4 = strtoupper(trim($_POST['member4_name'] ?? ''));
$member5 = strtoupper(trim($_POST['member5_name'] ?? ''));

if (empty($instructor) || empty($group_name)) {
    echo json_encode(["status" => "error", "message" => "instructor and group_name required"]);
    exit;
}

$check = "SELECT id, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE group_name=? AND instructor=? AND section=?";
$stmt = $conn->prepare($check);
$stmt->bind_param("sss", $group_name, $instructor, $section);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $old = $result->fetch_assoc();
    $oldNames = [strtoupper(trim($old['member1_name'])), strtoupper(trim($old['member2_name'])), strtoupper(trim($old['member3_name'])), strtoupper(trim($old['member4_name'])), strtoupper(trim($old['member5_name']))];
    $newNames = [$member1, $member2, $member3, $member4, $member5];

    $sql = "UPDATE groups_table SET member1_name=?, member2_name=?, member3_name=?, member4_name=?, member5_name=? WHERE group_name=? AND instructor=? AND section=?";
    $stmt2 = $conn->prepare($sql);
    $stmt2->bind_param("ssssssss", $member1, $member2, $member3, $member4, $member5, $group_name, $instructor, $section);
    $stmt2->execute();
    $stmt2->close();

    for ($i = 0; $i < 5; $i++) {
        $oldName = $oldNames[$i];
        $newName = $newNames[$i];
        if (!empty($oldName) && !empty($newName) && $oldName !== $newName) {
            $updateRate = $conn->prepare("UPDATE group_ratings SET rater_name=? WHERE rater_name=? AND instructor=?");
            $updateRate->bind_param("sss", $newName, $oldName, $instructor);
            $updateRate->execute();
            $updateRate->close();
        }
    }

    echo json_encode(["status" => "success", "message" => "Members saved successfully"]);
} else {
    $ins = $conn->prepare("INSERT INTO groups_table (group_name, instructor, section, member1_name, member2_name, member3_name, member4_name, member5_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $ins->bind_param("ssssssss", $group_name, $instructor, $section, $member1, $member2, $member3, $member4, $member5);
    $ins->execute();
    $ins->close();
    echo json_encode(["status" => "success", "message" => "Members saved successfully"]);
}
    $stmt->close();
}

$conn->close();
?>
