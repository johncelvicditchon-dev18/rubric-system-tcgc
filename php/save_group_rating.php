<?php
include __DIR__ . '/../includes/db_connect.php';

header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $input = json_decode(file_get_contents('php://input'), true);

    $group_name = $input['group_name'] ?? '';
    $rater_name = $input['rater_name'] ?? '';
    $section = $input['section'] ?? '';

    $student_sql = "SELECT instructor, section FROM groups_table WHERE member1_name=? OR member2_name=? OR member3_name=? OR member4_name=? OR member5_name=? LIMIT 1";
    $stmt_s = $conn->prepare($student_sql);
    $stmt_s->bind_param("sssss", $rater_name, $rater_name, $rater_name, $rater_name, $rater_name);
    $stmt_s->execute();
    $result_s = $stmt_s->get_result();
    $instructor = '';
    $section = $section ?: '';
    if ($result_s->num_rows > 0) {
        $row = $result_s->fetch_assoc();
        $instructor = $row['instructor'];
        if (empty($section)) $section = $row['section'] ?? '';
    }
    $stmt_s->close();

    $content_accuracy = intval($input['scores']['content_accuracy'] ?? 0);
    $understanding_topic = intval($input['scores']['understanding_topic'] ?? 0);
    $organization_structure = intval($input['scores']['organization_structure'] ?? 0);
    $delivery_communication = intval($input['scores']['delivery_communication'] ?? 0);
    $audience_engagement = intval($input['scores']['audience_engagement'] ?? 0);
    $visual_aids = intval($input['scores']['visual_aids'] ?? 0);
    $professional_appearance = intval($input['scores']['professional_appearance'] ?? 0);
    $teamwork_collaboration = intval($input['scores']['teamwork_collaboration'] ?? 0);
    $time_allocation = intval($input['scores']['time_allocation'] ?? 0);
    $strategies = intval($input['scores']['strategies'] ?? 0);
    $total_score = intval($input['total_score'] ?? ($content_accuracy + $understanding_topic + $organization_structure + $delivery_communication + $audience_engagement + $visual_aids + $professional_appearance + $teamwork_collaboration + $time_allocation + $strategies));

    $check = $conn->prepare("SELECT id FROM group_ratings WHERE rater_name=? AND group_name=? AND section=?");
    $check->bind_param("sss", $rater_name, $group_name, $section);
    $check->execute();
    $existing = $check->get_result()->fetch_assoc();
    $check->close();

    if ($existing) {
        $sql = "UPDATE group_ratings SET content_accuracy=?, understanding_topic=?, organization_structure=?, delivery_communication=?, audience_engagement=?, visual_aids=?, professional_appearance=?, teamwork_collaboration=?, time_allocation=?, strategies=?, total_score=?, instructor=? WHERE rater_name=? AND group_name=? AND section=?";
        $stmt2 = $conn->prepare($sql);
        $stmt2->bind_param("iiiiiiiiiiissss",
            $content_accuracy, $understanding_topic, $organization_structure,
            $delivery_communication, $audience_engagement, $visual_aids,
            $professional_appearance, $teamwork_collaboration, $time_allocation,
            $strategies, $total_score, $instructor,
            $rater_name, $group_name, $section
        );
    } else {
        $sql = "INSERT INTO group_ratings (rater_name, group_name, content_accuracy, understanding_topic, organization_structure, delivery_communication, audience_engagement, visual_aids, professional_appearance, teamwork_collaboration, time_allocation, strategies, total_score, instructor, section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt2 = $conn->prepare($sql);
        $stmt2->bind_param("ssiiiiiiiiiiiss",
            $rater_name, $group_name,
            $content_accuracy, $understanding_topic, $organization_structure,
            $delivery_communication, $audience_engagement, $visual_aids,
            $professional_appearance, $teamwork_collaboration, $time_allocation,
            $strategies, $total_score, $instructor, $section
        );
    }

    if ($stmt2->execute()) {
        echo json_encode(["status" => "success", "message" => "Rating saved successfully!", "total_score" => $total_score]);
    } else {
        echo json_encode(["status" => "error", "message" => "Error: " . $conn->error]);
    }
    $stmt2->close();
}

$conn->close();
?>
